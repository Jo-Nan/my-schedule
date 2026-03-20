import crypto from 'node:crypto';
import { ensureDataStore, getUserMapWorkspace, isMapShareActive, saveMapsByUser } from './_lib/store.js';
import { parseJsonBody, requireAuth } from './_lib/auth.js';

const makeShareToken = () => crypto.randomBytes(18).toString('base64url');
const MAP_SHARE_COOKIE = 'nanmuz_map_share';
const MAP_SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const clearShareCookie = (res) => {
  const parts = [
    `${MAP_SHARE_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  res.setHeader('Set-Cookie', parts.join('; '));
};

const setShareCookie = (res, token, expiresAt) => {
  const expiresAtMs = Date.parse(expiresAt || '');
  if (!token || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    clearShareCookie(res);
    return;
  }

  const maxAgeSeconds = Math.max(1, Math.floor((expiresAtMs - Date.now()) / 1000));
  const parts = [
    `${MAP_SHARE_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  res.setHeader('Set-Cookie', parts.join('; '));
};

const buildBaseUrl = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const protocolHeader = req.headers['x-forwarded-proto'];
  const protocol = Array.isArray(protocolHeader)
    ? protocolHeader[0]
    : (protocolHeader || (host.includes('localhost') ? 'http' : 'https'));
  return `${protocol}://${host}`;
};

const buildShareUrl = (req, token) => {
  const baseUrl = buildBaseUrl(req);
  if (!baseUrl || !token) {
    return '';
  }
  return `${baseUrl}/?page=map#share=${encodeURIComponent(token)}`;
};

const findOwnerByShareToken = (store, token) => {
  const users = Array.isArray(store?.users) ? store.users : [];
  return users.find((user) => {
    const workspace = getUserMapWorkspace(store.mapsByUser, user.id);
    return isMapShareActive(workspace?.share) && workspace.share.token === token;
  }) || null;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST') {
    const body = await parseJsonBody(req);
    const action = typeof body?.action === 'string' ? body.action.trim() : 'create';

    if (action === 'resolve') {
      const token = typeof body?.token === 'string' ? body.token.trim() : '';
      if (!token) {
        clearShareCookie(res);
        return res.status(400).json({ status: 'error', message: 'Missing share token' });
      }

      const store = await ensureDataStore();
      const owner = findOwnerByShareToken(store, token);
      if (!owner) {
        clearShareCookie(res);
        return res.status(404).json({ status: 'error', message: 'Share link not found or expired' });
      }

      const workspace = getUserMapWorkspace(store.mapsByUser, owner.id);
      setShareCookie(res, token, workspace.share?.expiresAt || '');
      return res.status(200).json({
        status: 'success',
        workspace,
        owner: {
          id: owner.id,
          username: owner.username || owner.email || 'Shared',
        },
        readOnly: true,
      });
    }

    const auth = await requireAuth(req, res);
    if (!auth) {
      return;
    }

    try {
      const currentWorkspace = getUserMapWorkspace(auth.mapsByUser, auth.user.id);

      if (action === 'disable') {
        auth.mapsByUser[auth.user.id] = {
          ...currentWorkspace,
          share: {
            ...currentWorkspace.share,
            enabled: false,
            expiresAt: '',
          },
        };
        await saveMapsByUser(auth.config, auth.mapsByUser);
        clearShareCookie(res);
        return res.status(200).json({
          status: 'success',
          share: {
            enabled: false,
            token: currentWorkspace.share?.token || '',
            expiresAt: '',
            url: '',
          },
        });
      }

      const keepToken = action === 'enable' && currentWorkspace.share?.token;
      const token = keepToken ? currentWorkspace.share.token : makeShareToken();
      const expiresAt = new Date(Date.now() + MAP_SHARE_TTL_MS).toISOString();
      auth.mapsByUser[auth.user.id] = {
        ...currentWorkspace,
        share: {
          enabled: true,
          token,
          expiresAt,
        },
      };
      await saveMapsByUser(auth.config, auth.mapsByUser);

      return res.status(200).json({
        status: 'success',
        share: {
          enabled: true,
          token,
          expiresAt,
          url: buildShareUrl(req, token),
        },
      });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to update map share settings',
      });
    }
  }

  res.setHeader('Allow', 'POST');
  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
}
