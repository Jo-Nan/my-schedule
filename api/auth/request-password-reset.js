import { parseJsonBody } from '../_lib/auth.js';
import { sendResetCodeEmail } from '../_lib/email.js';
import { ensureDataStore, findUserByEmail, generateResetCode, hashResetCode, saveUsers } from '../_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
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
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Failed to request reset code' });
  }
}
