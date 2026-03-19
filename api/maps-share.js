import crypto from 'node:crypto';
import { ensureDataStore, getUserMapWorkspace, saveMapsByUser } from './_lib/store.js';
import { parseJsonBody, requireAuth } from './_lib/auth.js';

const makeShareToken = () => crypto.randomBytes(18).toString('base64url');

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
  return `${baseUrl}/?page=map&share=${encodeURIComponent(token)}`;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (!token) {
      return res.status(400).json({ status: 'error', message: 'Missing share token' });
    }

    const store = await ensureDataStore();
    const owner = store.users.find((user) => {
      const workspace = getUserMapWorkspace(store.mapsByUser, user.id);
      return workspace?.share?.enabled && workspace?.share?.token === token;
    });

    if (!owner) {
      return res.status(404).json({ status: 'error', message: 'Share link not found or disabled' });
    }

    const workspace = getUserMapWorkspace(store.mapsByUser, owner.id);
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

  if (req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const action = typeof body?.action === 'string' ? body.action.trim() : 'create';
      const currentWorkspace = getUserMapWorkspace(auth.mapsByUser, auth.user.id);

      if (action === 'disable') {
        auth.mapsByUser[auth.user.id] = {
          ...currentWorkspace,
          share: {
            ...currentWorkspace.share,
            enabled: false,
          },
        };
        await saveMapsByUser(auth.config, auth.mapsByUser);
        return res.status(200).json({
          status: 'success',
          share: {
            enabled: false,
            token: currentWorkspace.share?.token || '',
            url: currentWorkspace.share?.token ? buildShareUrl(req, currentWorkspace.share.token) : '',
          },
        });
      }

      const keepToken = action === 'enable' && currentWorkspace.share?.token;
      const token = keepToken ? currentWorkspace.share.token : makeShareToken();
      auth.mapsByUser[auth.user.id] = {
        ...currentWorkspace,
        share: {
          enabled: true,
          token,
        },
      };
      await saveMapsByUser(auth.config, auth.mapsByUser);

      return res.status(200).json({
        status: 'success',
        share: {
          enabled: true,
          token,
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

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
}
