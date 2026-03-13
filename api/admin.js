import { parseJsonBody, requireAdmin } from './_lib/auth.js';
import {
  findUserById,
  findUserByEmail,
  getUserPlans,
  getUserSnapshots,
  createUserRecord,
  publicUser,
  saveUsers,
  savePlansByUser,
  saveSnapshotsByUser,
  setUserPlans,
  upsertUserSnapshot,
  restoreUserSnapshot,
  getMessages,
} from './_lib/store.js';

/**
 * Unified Admin Endpoint
 * Routes:
 * - GET /api/admin?action=users -> List all users
 * - POST /api/admin?action=users -> Create user
 * - DELETE /api/admin?action=users&id=userId -> Delete user
 * - POST /api/admin?action=restore-user&id=userId -> Restore user
 * - GET /api/admin?action=user-plans&userId=xxx -> Get user's plans
 * - POST /api/admin?action=user-plans&userId=xxx -> Save user's plans
 * - GET /api/admin?action=user-snapshots&id=xxx -> Get user's snapshots
 * - POST /api/admin?action=restore-snapshot -> Restore user's snapshot
 * - GET /api/admin?action=messages -> Get all messages
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await requireAdmin(req, res);
  if (!auth) {
    return;
  }

  const action = req.query.action || '';

  try {
    // GET /api/admin?action=users - List all users
    if (req.method === 'GET' && action === 'users') {
      const users = auth.users
        .map((user) => ({
          ...publicUser(user),
          planCount: getUserPlans(auth.plansByUser, user.id).length,
        }))
        .sort((left, right) => {
          if (left.role !== right.role) {
            return left.role === 'admin' ? -1 : 1;
          }
          return left.createdAt.localeCompare(right.createdAt);
        });

      return res.status(200).json({ status: 'success', users });
    }

    // POST /api/admin?action=users - Create user
    if (req.method === 'POST' && action === 'users') {
      const body = await parseJsonBody(req);
      const email = (body.email || '').trim();
      const password = body.password || '';
      const username = (body.username || '').trim();

      if (!email || !password) {
        return res.status(400).json({ status: 'error', message: 'Email and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
      }

      const existingUser = findUserByEmail(auth.users, email);
      if (existingUser && existingUser.isActive !== false) {
        return res.status(409).json({ status: 'error', message: 'Email is already registered' });
      }

      const user = createUserRecord({ email, username, password, role: 'user' });
      auth.users.push(user);
      auth.plansByUser[user.id] = [];

      await saveUsers(auth.config, auth.users);
      await savePlansByUser(auth.config, auth.plansByUser);

      return res.status(201).json({ status: 'success', user: publicUser(user) });
    }

    // DELETE /api/admin?action=users&id=userId - Delete user
    if (req.method === 'DELETE' && action === 'users') {
      const userId = String(req.query.id || '');
      const targetUser = auth.users.find((user) => user.id === userId);

      if (!targetUser) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      if (targetUser.role === 'admin') {
        return res.status(400).json({ status: 'error', message: 'Admin user cannot be deleted' });
      }

      targetUser.isActive = false;
      targetUser.updatedAt = new Date().toISOString();

      await saveUsers(auth.config, auth.users);
      return res.status(200).json({ status: 'success' });
    }

    // POST /api/admin?action=restore-user&id=userId - Restore user
    if (req.method === 'POST' && action === 'restore-user') {
      const userId = String(req.query.id || '');
      const targetUser = auth.users.find((user) => user.id === userId);

      if (!targetUser) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      if (targetUser.isActive !== false) {
        return res.status(400).json({ status: 'error', message: 'User is already active' });
      }

      targetUser.isActive = true;
      targetUser.updatedAt = new Date().toISOString();

      await saveUsers(auth.config, auth.users);
      return res.status(200).json({ status: 'success' });
    }

    // GET /api/admin?action=user-plans&userId=xxx - Get user's plans
    if (req.method === 'GET' && action === 'user-plans') {
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

    // POST /api/admin?action=user-plans&userId=xxx - Save user's plans
    if (req.method === 'POST' && action === 'user-plans') {
      const body = await parseJsonBody(req);
      const userId = String(body.userId || req.query.userId || '');
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
    }

    // GET /api/admin?action=user-snapshots&id=xxx - Get user's snapshots
    if (req.method === 'GET' && action === 'user-snapshots') {
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

    // POST /api/admin?action=restore-snapshot - Restore user's snapshot
    if (req.method === 'POST' && action === 'restore-snapshot') {
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
    }

    // GET /api/admin?action=messages - Get all messages
    if (req.method === 'GET' && action === 'messages') {
      return res.status(200).json({
        status: 'success',
        messages: getMessages(auth.messages),
      });
    }

    // Unknown action or method
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(400).json({ status: 'error', message: `Unknown admin action or method: ${action} ${req.method}` });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Admin operation failed' });
  }
}
