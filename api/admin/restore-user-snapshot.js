import { parseJsonBody, requireAdmin } from '../_lib/auth.js';
import {
  findUserById,
  restoreUserSnapshot,
  savePlansByUser,
  saveSnapshotsByUser,
  upsertUserSnapshot,
} from '../_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) {
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const userId = String(body.userId || '');
    const snapshotId = String(body.snapshotId || '');
    const user = findUserById(auth.users, userId);

    if (!user || user.isActive === false) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    upsertUserSnapshot(auth.snapshotsByUser, userId, auth.plansByUser[userId] || [], 'pre_restore');
    const restoredSnapshot = restoreUserSnapshot(auth.plansByUser, auth.snapshotsByUser, userId, snapshotId);

    if (!restoredSnapshot) {
      return res.status(404).json({ status: 'error', message: 'Snapshot not found' });
    }

    upsertUserSnapshot(auth.snapshotsByUser, userId, auth.plansByUser[userId] || [], 'restore');
    await savePlansByUser(auth.config, auth.plansByUser);
    await saveSnapshotsByUser(auth.config, auth.snapshotsByUser);

    return res.status(200).json({ status: 'success', snapshot: restoredSnapshot });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Failed to restore snapshot' });
  }
}
