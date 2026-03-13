import { parseJsonBody, setSessionCookie, clearSessionCookie, requireAuth, getAuthenticatedUser } from './_lib/auth.js';
import {
  ensureDataStore,
  findUserByEmail,
  findUserById,
  createUserRecord,
  publicUser,
  saveUsers,
  savePlansByUser,
  hashPassword,
  verifyPassword,
  generateResetCode,
  hashResetCode,
} from './_lib/store.js';
import { sendResetCodeEmail } from './_lib/email.js';

/**
 * Unified Auth Endpoint
 * Routes:
 * - GET /api/auth -> Get current user (me)
 * - POST /api/auth?action=login -> Login
 * - POST /api/auth?action=logout -> Logout
 * - POST /api/auth?action=register -> Register
 * - POST /api/auth?action=request-password-reset -> Request password reset code
 * - POST /api/auth?action=reset-password -> Reset password with code
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // GET /api/auth - Get current user
  if (req.method === 'GET') {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    return res.status(200).json({ status: 'success', user: auth.safeUser });
  }

  // POST routes
  if (req.method === 'POST') {
    const action = req.query.action || '';

    try {
      // POST /api/auth?action=login
      if (action === 'login') {
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
      }

      // POST /api/auth?action=logout
      if (action === 'logout') {
        clearSessionCookie(res);
        return res.status(200).json({ status: 'success' });
      }

      // POST /api/auth?action=register
      if (action === 'register') {
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

        const existingUser = findUserByEmail(store.users, email);
        if (existingUser && existingUser.isActive !== false) {
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
      }

      // POST /api/auth?action=request-password-reset
      if (action === 'request-password-reset') {
        const body = await parseJsonBody(req);
        const email = (body.email || '').trim();
        const store = await ensureDataStore();
        const user = findUserByEmail(store.users, email);

        if (!user || user.isActive === false) {
          return res.status(200).json({ status: 'success' });
        }

        const code = generateResetCode();
        user.resetCodeHash = hashResetCode(code);
        user.resetCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        user.updatedAt = new Date().toISOString();
        await saveUsers(store.config, store.users);

        const emailResult = await sendResetCodeEmail({ email: user.email, code });

        return res.status(200).json({
          status: 'success',
          emailStatus: emailResult.skipped ? 'skipped' : 'sent',
        });
      }

      // POST /api/auth?action=reset-password
      if (action === 'reset-password') {
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
      }

      // Unknown action
      res.setHeader('Allow', 'GET, POST');
      return res.status(400).json({ status: 'error', message: `Unknown auth action: ${action}` });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message || 'Auth operation failed' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
}
