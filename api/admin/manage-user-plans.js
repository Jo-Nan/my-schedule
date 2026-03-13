import { parseJsonBody, requireAdmin } from '../_lib/auth.js';
import {
  findUserById,
  getUserPlans,
  publicUser,
  savePlansByUser,
  saveSnapshotsByUser,
  setUserPlans,
  upsertUserSnapshot,
} from '../_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await requireAdmin(req, res);
  if (!auth) {
    return;
  }

  if (req.method === 'GET') {
    const userId = String(req.query.userId || '');
    const user = findUserById(auth.users, userId);

    if (!user || user.isActive === false) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    return res.status(200).json({
      status: 'success',
      user: publicUser(user),
      plans: getUserPlans(auth.plansByUser, user.id),
    });
  }

  if (req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const userId = String(body.userId || '');
      const plans = body.plans;
      const user = findUserById(auth.users, userId);

      if (!user || user.isActive === false) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      if (!Array.isArray(plans)) {
        return res.status(400).json({ status: 'error', message: 'Plans must be an array' });
      }

      const savedPlans = setUserPlans(auth.plansByUser, userId, plans);
      upsertUserSnapshot(auth.snapshotsByUser, userId, savedPlans, 'admin_save');
      await savePlansByUser(auth.config, auth.plansByUser);
      await saveSnapshotsByUser(auth.config, auth.snapshotsByUser);

      return res.status(200).json({
        status: 'success',
        user: publicUser(user),
        count: savedPlans.length,
      });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to save managed plans' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
}
