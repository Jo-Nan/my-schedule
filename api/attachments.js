import { Readable } from 'node:stream';
import { del, get } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import { getAuthenticatedUser, parseJsonBody } from './_lib/auth.js';
import { findUserById } from './_lib/store.js';

const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/*',
  'text/plain',
];

const parseClientPayload = (value) => {
  if (!value || typeof value !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const canAccessTargetUser = (auth, targetUserId) => {
  if (!targetUserId) {
    return false;
  }

  if (targetUserId === auth.user.id) {
    return true;
  }

  if (auth.user.role !== 'admin') {
    return false;
  }

  const targetUser = findUserById(auth.users, targetUserId);
  return Boolean(targetUser && targetUser.isActive !== false);
};

const isValidAttachmentPathname = (pathname, targetUserId) => {
  if (typeof pathname !== 'string' || !pathname) {
    return false;
  }

  if (pathname.includes('..')) {
    return false;
  }

  const expectedPrefix = `attachments/${targetUserId}/`;
  return pathname.startsWith(expectedPrefix);
};

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

const pickString = (value) => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }
  return typeof value === 'string' ? value : '';
};

const sanitizeDownloadName = (value = '') => {
  const cleaned = String(value || 'file')
    .replace(/[\r\n"]/g, '')
    .trim();
  return cleaned || 'file';
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const action = String(req.query.action || '').trim();
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (!blobToken) {
    return res.status(500).json({
      status: 'error',
      message: 'BLOB_READ_WRITE_TOKEN is not configured',
    });
  }

  if (action === 'upload' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const requiresSession = body?.type === 'blob.generate-client-token';
      const auth = requiresSession ? await getAuthenticatedUser(req) : null;

      if (requiresSession && !auth) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
      }

      const response = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          if (!auth) {
            throw new Error('Unauthorized');
          }

          const payload = parseClientPayload(clientPayload);
          const requestedTargetUserId = typeof payload.targetUserId === 'string' ? payload.targetUserId.trim() : '';
          const targetUserId = requestedTargetUserId || auth.user.id;

          if (!canAccessTargetUser(auth, targetUserId)) {
            throw new Error('Forbidden target user');
          }

          if (!isValidAttachmentPathname(pathname, targetUserId)) {
            throw new Error('Invalid attachment pathname');
          }

          return {
            allowedContentTypes: ALLOWED_CONTENT_TYPES,
            maximumSizeInBytes: MAX_UPLOAD_SIZE_BYTES,
            addRandomSuffix: false,
            tokenPayload: JSON.stringify({
              uploaderUserId: auth.user.id,
              targetUserId,
              planId: typeof payload.planId === 'string' ? payload.planId : '',
            }),
            validUntil: Date.now() + 15 * 60 * 1000,
          };
        },
        onUploadCompleted: async () => {},
      });

      return res.status(200).json(response);
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to generate upload token',
      });
    }
  }

  if (action === 'read' && req.method === 'GET') {
    try {
      const auth = await getAuthenticatedUser(req);
      if (!auth) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
      }

      const queryTargetUserId = pickString(req.query.targetUserId).trim();
      const targetUserId = queryTargetUserId || auth.user.id;

      if (!canAccessTargetUser(auth, targetUserId)) {
        return res.status(403).json({ status: 'error', message: 'Forbidden target user' });
      }

      const pathnameFromQuery = pickString(req.query.pathname).trim();
      const urlFromQuery = pickString(req.query.url).trim();
      const pathname = pathnameFromQuery || getPathnameFromUrl(urlFromQuery);

      if (!pathname || !isValidAttachmentPathname(pathname, targetUserId)) {
        return res.status(403).json({ status: 'error', message: 'Invalid attachment path' });
      }

      const mode = pickString(req.query.mode) === 'download' ? 'download' : 'inline';
      const blobResult = await get(pathname, {
        access: 'private',
      });

      if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
        return res.status(404).json({ status: 'error', message: 'Attachment not found' });
      }

      const queryFilename = pickString(req.query.filename).trim();
      const filename = queryFilename
        ? sanitizeDownloadName(queryFilename)
        : sanitizeDownloadName(pathname.split('/').pop() || 'file');
      res.statusCode = 200;
      res.setHeader('Content-Type', blobResult.blob.contentType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `${mode === 'download' ? 'attachment' : 'inline'}; filename="${filename}"`,
      );
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
      return;
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to read attachment',
      });
    }
  }

  if (action === 'delete' && req.method === 'POST') {
    try {
      const auth = await getAuthenticatedUser(req);
      if (!auth) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
      }

      const body = await parseJsonBody(req);
      const targetUserId = typeof body.targetUserId === 'string' && body.targetUserId.trim()
        ? body.targetUserId.trim()
        : auth.user.id;

      if (!canAccessTargetUser(auth, targetUserId)) {
        return res.status(403).json({ status: 'error', message: 'Forbidden target user' });
      }

      const pathnameFromBody = typeof body.pathname === 'string' ? body.pathname.trim() : '';
      const url = typeof body.url === 'string' ? body.url.trim() : '';
      const pathname = pathnameFromBody || getPathnameFromUrl(url);
      if (!isValidAttachmentPathname(pathname, targetUserId)) {
        return res.status(403).json({ status: 'error', message: 'Invalid attachment path' });
      }

      await del(pathname);
      return res.status(200).json({ status: 'success' });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to delete attachment' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
}
