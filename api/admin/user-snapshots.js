import { requireAdmin } from '../_lib/auth.js';
import { findUserById, getUserSnapshots, publicUser } from '../_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) {
    return;
  }

  const userId = String(req.query.id || '');
  const user = findUserById(auth.users, userId);

  if (!user || user.isActive === false) {
    return res.status(404).json({ status: 'error', message: 'User not found' });
  }

  const snapshots = getUserSnapshots(auth.snapshotsByUser, user.id).map((snapshot) => ({
    id: snapshot.id,
    snapshotDate: snapshot.snapshotDate,
    createdAt: snapshot.createdAt,
    source: snapshot.source,
    planCount: snapshot.plans.length,
  }));

  return res.status(200).json({
    status: 'success',
    user: publicUser(user),
    snapshots,
  });
}
