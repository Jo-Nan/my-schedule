import { sendBirthdayGreetingEmail } from './_lib/email.js';
import { ensureDataStore, getShanghaiDateString, saveUsers } from './_lib/store.js';

/**
 * Unified Cron Endpoint
 * Routes:
 * - GET /api/cron?action=tasks -> Get all cron tasks status
 * - GET /api/cron?action=birthday-greetings -> Send birthday greetings
 * - POST /api/cron?action=birthday-greetings -> Manually trigger birthday greetings
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const action = req.query.action || '';

  try {
    // GET /api/cron?action=tasks - Get cron tasks info
    if (req.method === 'GET' && action === 'tasks') {
      const store = await ensureDataStore();
      const today = getShanghaiDateString();
      
      // 统计今天有生日的用户
      const monthDay = today.slice(5);
      const currentYear = today.slice(0, 4);
      const usersWithBirthdayToday = store.users.filter((user) => {
        return user.isActive !== false && user.birthday && user.birthday.slice(5) === monthDay;
      });
      
      const alreadySentToday = usersWithBirthdayToday.filter((user) => {
        return user.lastBirthdayGreetingYear === currentYear;
      }).length;
      
      const tasks = [
        {
          id: 'birthday-greetings',
          name: 'Birthday Greetings',
          description: 'Send birthday greeting emails to users with birthdays today',
          schedule: 'Every day at 00:00 (Shanghai)',
          lastRun: null,
          nextRun: `${today} 00:00`,
          status: 'scheduled',
          stats: {
            usersWithBirthdayToday: usersWithBirthdayToday.length,
            alreadySentToday: alreadySentToday,
            pending: usersWithBirthdayToday.length - alreadySentToday,
          },
        },
      ];
      
      return res.status(200).json({ status: 'success', tasks });
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ status: 'error', message: 'Method not allowed' });
    }

    // GET or POST /api/cron?action=birthday-greetings
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
