import { Readable } from 'node:stream';
import { get } from '@vercel/blob';
import { ensureDataStore, getUserMapWorkspace, isMapShareActive } from './_lib/store.js';

const MAP_SHARE_COOKIE = 'nanmuz_map_share';

const pickString = (value) => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }
  return typeof value === 'string' ? value : '';
};

const parseCookies = (cookieHeader = '') => Object.fromEntries(
  cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const index = chunk.indexOf('=');
      return [chunk.slice(0, index), decodeURIComponent(chunk.slice(index + 1))];
    })
    .filter(([key]) => key)
);

const getPathnameFromUrl = (urlOrPathname) => {
  if (typeof urlOrPathname !== 'string' || !urlOrPathname) {
    return '';
  }

  try {
    const parsed = new URL(urlOrPathname);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  } catch {
    return urlOrPathname.replace(/^\/+/, '');
  }
};

const isValidSharedMapPath = (pathname, ownerId) => {
  if (typeof pathname !== 'string' || !pathname || pathname.includes('..')) {
    return false;
  }
  return pathname.startsWith(`attachments/${ownerId}/map/`);
};

const findOwnerByShareToken = (store, token) => {
  const users = Array.isArray(store?.users) ? store.users : [];
  return users.find((user) => {
    const workspace = getUserMapWorkspace(store.mapsByUser, user.id);
    return isMapShareActive(workspace?.share) && workspace.share.token === token;
  }) || null;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return res.status(500).json({
      status: 'error',
      message: 'BLOB_READ_WRITE_TOKEN is not configured',
    });
  }

  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = pickString(cookies[MAP_SHARE_COOKIE]).trim();
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Missing share session' });
    }

    const store = await ensureDataStore();
    const owner = findOwnerByShareToken(store, token);
    if (!owner) {
      return res.status(404).json({ status: 'error', message: 'Share link not found or disabled' });
    }

    const pathnameFromQuery = pickString(req.query.pathname).trim();
    const urlFromQuery = pickString(req.query.url).trim();
    const pathname = pathnameFromQuery || getPathnameFromUrl(urlFromQuery);

    if (!isValidSharedMapPath(pathname, owner.id)) {
      return res.status(403).json({ status: 'error', message: 'Invalid attachment path' });
    }

    const blobResult = await get(pathname, {
      access: 'private',
    });

    if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
      return res.status(404).json({ status: 'error', message: 'Attachment not found' });
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', blobResult.blob.contentType || 'application/octet-stream');
    if (Number.isFinite(blobResult.blob.size)) {
      res.setHeader('Content-Length', String(blobResult.blob.size));
    }
    res.setHeader('Cache-Control', 'private, no-store');

    const stream = Readable.fromWeb(blobResult.stream);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).end('Stream error');
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
    return undefined;
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to read shared map attachment',
    });
  }
}
