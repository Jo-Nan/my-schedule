import { parseJsonBody, setSessionCookie } from '../_lib/auth.js';
import { ensureDataStore, findUserByEmail, publicUser, verifyPassword } from '../_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const email = (body.email || '').trim();
    const password = body.password || '';
    const store = await ensureDataStore();
    const user = findUserByEmail(store.users, email);

    if (!user || user.isActive === false || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    setSessionCookie(res, user);

    return res.status(200).json({
      status: 'success',
      user: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Login failed' });
  }
}
