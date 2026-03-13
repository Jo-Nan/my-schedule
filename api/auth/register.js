import { parseJsonBody, setSessionCookie } from '../_lib/auth.js';
import { createUserRecord, ensureDataStore, findUserByEmail, publicUser, savePlansByUser, saveUsers } from '../_lib/store.js';

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
    const username = (body.username || '').trim();

    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
    }

    const store = await ensureDataStore();

    if (findUserByEmail(store.users, email)) {
      return res.status(409).json({ status: 'error', message: 'Email is already registered' });
    }

    const user = createUserRecord({ email, username, password, role: 'user' });
    store.users.push(user);
    store.plansByUser[user.id] = [];

    await saveUsers(store.config, store.users);
    await savePlansByUser(store.config, store.plansByUser);

    setSessionCookie(res, user);

    return res.status(201).json({
      status: 'success',
      user: publicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Registration failed' });
  }
}
