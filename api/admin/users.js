import { parseJsonBody, requireAdmin } from '../_lib/auth.js';
import {
  createUserRecord,
  findUserByEmail,
  getUserPlans,
  publicUser,
  savePlansByUser,
  saveUsers,
} from '../_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await requireAdmin(req, res);
  if (!auth) {
    return;
  }

  if (req.method === 'GET') {
    const users = auth.users
      .filter((user) => user.isActive !== false)
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

  if (req.method === 'POST') {
    try {
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

      if (findUserByEmail(auth.users, email)) {
        return res.status(409).json({ status: 'error', message: 'Email is already registered' });
      }

      const user = createUserRecord({ email, username, password, role: 'user' });
      auth.users.push(user);
      auth.plansByUser[user.id] = [];

      await saveUsers(auth.config, auth.users);
      await savePlansByUser(auth.config, auth.plansByUser);

      return res.status(201).json({ status: 'success', user: publicUser(user) });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to create user' });
    }
  }

  if (req.method === 'DELETE') {
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

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
}
