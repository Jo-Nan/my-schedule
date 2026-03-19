import { parseJsonBody, requireAuth } from './_lib/auth.js';
import {
  getUserMapWorkspace,
  saveMapsByUser,
  setUserMapWorkspace,
  assertUserWorkspaceQuota,
} from './_lib/store.js';

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
      const body = await parseJsonBody(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({
          status: 'error',
          message: 'Request body must be a JSON object',
        });
      }

      const workspace = body.workspace && typeof body.workspace === 'object' && !Array.isArray(body.workspace)
        ? body.workspace
        : body;
      const expectedRevision = Number.isInteger(body.expectedRevision)
        ? body.expectedRevision
        : null;
      const force = body.force === true;

      assertUserWorkspaceQuota({
        users: auth.users,
        plansByUser: auth.plansByUser,
        mapsByUser: auth.mapsByUser,
        userId: auth.user.id,
        nextMapWorkspace: workspace,
      });

      const result = setUserMapWorkspace(auth.mapsByUser, auth.user.id, workspace, {
        expectedRevision,
        force,
      });
      if (result.conflict) {
        return res.status(409).json({
          status: 'error',
          code: 'MAP_WORKSPACE_CONFLICT',
          message: 'Map workspace was changed by another session.',
          workspace: result.currentWorkspace,
        });
      }

      await saveMapsByUser(auth.config, auth.mapsByUser);

      return res.status(200).json({
        status: 'success',
        source: auth.config.mode,
        workspace: result.savedWorkspace,
      });
    } catch (error) {
      if (error?.code === 'USER_STORAGE_LIMIT_EXCEEDED') {
        const limitMB = (Number(error.limitBytes) / (1024 * 1024)).toFixed(0);
        const totalMB = (Number(error.totalBytes) / (1024 * 1024)).toFixed(2);
        return res.status(400).json({
          status: 'error',
          code: error.code,
          message: `普通用户总数据不能超过 ${limitMB}MB（含日程与地图）。当前约 ${totalMB}MB，请精简后再保存。`,
        });
      }
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Unexpected error while saving map workspace',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
}
