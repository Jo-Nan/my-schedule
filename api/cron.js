import { sendBirthdayGreetingEmail } from './_lib/email.js';
import { ensureDataStore, getShanghaiDateString, saveUsers } from './_lib/store.js';

/**
 * Unified Cron Endpoint
 * Routes:
 * - GET /api/cron?action=birthday-greetings -> Send birthday greetings
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const action = req.query.action || '';

  try {
    // GET /api/cron?action=birthday-greetings
    if (action === 'birthday-greetings') {
      const store = await ensureDataStore();
      const today = getShanghaiDateString();
      const monthDay = today.slice(5);
      const currentYear = today.slice(0, 4);
      const sent = [];
      const skipped = [];

      for (const user of store.users) {
        if (user.isActive === false || !user.birthday || user.birthday.slice(5) !== monthDay || user.lastBirthdayGreetingYear === currentYear) {
          continue;
        }

        const result = await sendBirthdayGreetingEmail({ email: user.email, username: user.username || '' });
        if (result.sent || result.skipped) {
          user.lastBirthdayGreetingYear = currentYear;
          user.updatedAt = new Date().toISOString();
          if (result.sent) {
            sent.push(user.email);
          } else {
            skipped.push({ email: user.email, reason: result.reason || 'skipped' });
          }
        }
      }

      await saveUsers(store.config, store.users);
      return res.status(200).json({ status: 'success', sent, skipped });
    }

    // Unknown action
    return res.status(400).json({ status: 'error', message: `Unknown cron action: ${action}` });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Cron operation failed' });
  }
}
