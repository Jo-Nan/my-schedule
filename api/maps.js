import { parseJsonBody, requireAuth } from './_lib/auth.js';
import { getUserMapWorkspace, saveMapsByUser, setUserMapWorkspace } from './_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (req.method === 'GET') {
    const workspace = getUserMapWorkspace(auth.mapsByUser, auth.user.id);
    return res.status(200).json({
      status: 'success',
      source: auth.config.mode,
      workspace,
    });
  }

  if (req.method === 'POST') {
    try {
      const workspace = await parseJsonBody(req);
      if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) {
        return res.status(400).json({
          status: 'error',
          message: 'Request body must be a JSON object',
        });
      }

      const savedWorkspace = setUserMapWorkspace(auth.mapsByUser, auth.user.id, workspace);
      await saveMapsByUser(auth.config, auth.mapsByUser);

      return res.status(200).json({
        status: 'success',
        source: auth.config.mode,
        workspace: savedWorkspace,
      });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Unexpected error while saving map workspace',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
}
