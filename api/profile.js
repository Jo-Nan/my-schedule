import { parseJsonBody, requireAuth } from './_lib/auth.js';
import { hashPassword, isValidBirthday, publicUser, saveUsers, updateUserProfile, verifyPassword } from './_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'success', user: publicUser(auth.user) });
  }

  if (req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const nextUsername = typeof body.username === 'string' ? body.username.trim() : auth.user.username || '';
      const nextBirthday = typeof body.birthday === 'string' ? body.birthday.trim() : auth.user.birthday || '';
      const currentPassword = body.currentPassword || '';
      const newPassword = body.newPassword || '';

      if (nextBirthday && !isValidBirthday(nextBirthday)) {
        return res.status(400).json({ status: 'error', message: 'Birthday must be in YYYY-MM-DD format' });
      }

      let passwordHash = auth.user.passwordHash;
      if (newPassword) {
        if (!currentPassword || !verifyPassword(currentPassword, auth.user.passwordHash)) {
          return res.status(400).json({ status: 'error', message: 'Current password is incorrect' });
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ status: 'error', message: 'New password must be at least 6 characters' });
        }
        passwordHash = hashPassword(newPassword);
      }

      const updatedUser = updateUserProfile(auth.user, {
        username: nextUsername,
        birthday: nextBirthday,
        passwordHash,
      });

      const index = auth.users.findIndex((user) => user.id === auth.user.id);
      auth.users[index] = updatedUser;
      await saveUsers(auth.config, auth.users);

      return res.status(200).json({ status: 'success', user: publicUser(updatedUser) });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to update profile' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
}
