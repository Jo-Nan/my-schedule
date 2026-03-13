import { parseJsonBody } from '../_lib/auth.js';
import { ensureDataStore, findUserByEmail, hashPassword, hashResetCode, publicUser, saveUsers } from '../_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const email = (body.email || '').trim();
    const code = String(body.code || '').trim();
    const newPassword = body.newPassword || '';

    if (!email || !code || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Email, code and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
    }

    const store = await ensureDataStore();
    const user = findUserByEmail(store.users, email);

    if (!user || user.isActive === false) {
      return res.status(400).json({ status: 'error', message: 'Invalid reset request' });
    }

    if (!user.resetCodeHash || !user.resetCodeExpiresAt) {
      return res.status(400).json({ status: 'error', message: 'No active reset code' });
    }

    if (new Date(user.resetCodeExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ status: 'error', message: 'Reset code expired' });
    }

    if (hashResetCode(code) !== user.resetCodeHash) {
      return res.status(400).json({ status: 'error', message: 'Invalid reset code' });
    }

    user.passwordHash = hashPassword(newPassword);
    user.resetCodeHash = '';
    user.resetCodeExpiresAt = '';
    user.updatedAt = new Date().toISOString();
    await saveUsers(store.config, store.users);

    return res.status(200).json({ status: 'success', user: publicUser(user) });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Failed to reset password' });
  }
}
