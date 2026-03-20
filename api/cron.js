import { sendBirthdayGreetingEmail } from './_lib/email.js';
import { ensureDataStore, getShanghaiDateString, saveUsers } from './_lib/store.js';
import { getAuthenticatedUser } from './_lib/auth.js';

const CRON_EMAIL_DELIVERY_ENABLED = false;
const CRON_EMAILS_DISABLED_REASON = 'Scheduled email delivery is temporarily paused in code.';

const buildCronPausedResponse = (message = CRON_EMAILS_DISABLED_REASON) => ({
  status: 'success',
  paused: true,
  message,
  sent: [],
  failed: [],
  skipped: [],
});

// 内部邮件发送函数
const sendEmail = async ({ to, subject, text }) => {
  if (!CRON_EMAIL_DELIVERY_ENABLED) {
    return {
      sent: false,
      skipped: true,
      disabled: true,
      reason: CRON_EMAILS_DISABLED_REASON,
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.MAIL_FROM || process.env.RESEND_FROM;

  if (!apiKey || !fromEmail) {
    return {
      sent: false,
      skipped: true,
      reason: 'Missing RESEND_API_KEY or MAIL_FROM',
    };
  }

  const resendApiUrl = 'https://api.resend.com/emails';
  const response = await fetch(resendApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to send email: ${details}`);
  }

  const result = await response.json();
  return {
    sent: true,
    skipped: false,
    id: result.id || null,
  };
};

/**
 * Unified Cron Endpoint
 * Routes:
 * - GET /api/cron?action=tasks -> Get all cron tasks status
 * - GET/POST /api/cron?action=birthday-greetings -> Birthday greetings
 * - POST /api/cron?action=daily-digest -> Send 08:05 morning digest
 * - POST /api/cron?action=evening-report -> Send 22:05 evening report
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
          name: '生日祝福',
          description: CRON_EMAIL_DELIVERY_ENABLED
            ? '每天给有生日的用户发送祝福邮件'
            : '生日祝福邮件已临时暂停，模块仍保留。',
          schedule: 'Every day at 00:00 (Shanghai)',
          lastRun: null,
          nextRun: CRON_EMAIL_DELIVERY_ENABLED ? `${today} 00:00` : null,
          status: CRON_EMAIL_DELIVERY_ENABLED ? 'scheduled' : 'paused',
          stats: {
            usersWithBirthdayToday: usersWithBirthdayToday.length,
            alreadySentToday: alreadySentToday,
            pending: usersWithBirthdayToday.length - alreadySentToday,
          },
        },
        {
          id: 'daily-digest',
          name: '今日简报',
          description: CRON_EMAIL_DELIVERY_ENABLED
            ? '每天早上 08:05 发送今日任务摘要'
            : '今日简报邮件已临时暂停，模块仍保留。',
          schedule: 'Every day at 08:05 (Shanghai)',
          lastRun: null,
          nextRun: CRON_EMAIL_DELIVERY_ENABLED ? `${today} 08:05` : null,
          status: CRON_EMAIL_DELIVERY_ENABLED ? 'scheduled' : 'paused',
          stats: {
            nextSend: CRON_EMAIL_DELIVERY_ENABLED ? 'All active users' : 'Paused',
          },
        },
        {
          id: 'evening-report',
          name: '晚报邮件',
          description: CRON_EMAIL_DELIVERY_ENABLED
            ? '每天晚上 22:05 发送当日总结和任务详情'
            : '晚报邮件已临时暂停，模块仍保留。',
          schedule: 'Every day at 22:05 (Shanghai)',
          lastRun: null,
          nextRun: CRON_EMAIL_DELIVERY_ENABLED ? `${today} 22:05` : null,
          status: CRON_EMAIL_DELIVERY_ENABLED ? 'scheduled' : 'paused',
          stats: {
            nextSend: CRON_EMAIL_DELIVERY_ENABLED ? 'All active users' : 'Paused',
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
      if (!CRON_EMAIL_DELIVERY_ENABLED) {
        return res.status(200).json(buildCronPausedResponse('Birthday greeting emails are temporarily paused.'));
      }

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

    // POST /api/cron?action=daily-digest - Send morning digest
    if (action === 'daily-digest' && req.method === 'POST') {
      if (!CRON_EMAIL_DELIVERY_ENABLED) {
        return res.status(200).json(buildCronPausedResponse('Daily digest emails are temporarily paused.'));
      }

      const store = await ensureDataStore();
      const today = getShanghaiDateString();
      const sent = [];
      const failed = [];

      for (const user of store.users) {
        if (user.isActive === false) continue;

        const userPlans = store.plansByUser[user.id] || [];
        const todayPlans = userPlans.filter((p) => p.date === today);
        const completedCount = todayPlans.filter((p) => p.progress === 100 || p.status === 'completed').length;
        const pendingCount = todayPlans.length - completedCount;

        // 找出即将截止的任务（未来 6 小时内）
        const now = new Date();
        const in6Hours = new Date(now.getTime() + 6 * 60 * 60 * 1000);
        const urgentPlans = todayPlans.filter((p) => {
          if (!p.time) return false;
          const planTime = new Date(`${p.date} ${p.time}`);
          return planTime <= in6Hours && planTime > now;
        }).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

        const subject = `📋 今日简报 - ${today} | ${completedCount}/${todayPlans.length} 已完成`;
        const text = `
╔════════════════════════════════════════╗
║         ${user.username || '亲爱的用户'}，早上好！ 📅        ║
╚════════════════════════════════════════╝

📋 【今日任务统计】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 总任务数：${todayPlans.length} 个
• 已完成：${completedCount} 个 ✅
• 待完成：${pendingCount} 个 ⏳
• 完成率：${todayPlans.length ? Math.round((completedCount / todayPlans.length) * 100) : 0}%

${urgentPlans.length > 0 ? `⏰ 【即将截止 (6小时内)】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${urgentPlans.map((p) => `• ${p.time} - ${p.event} (${p.person})`).join('\n')}

` : ''}🌤️ 祝你有一个高效的一天！💪
加油，${user.username || '你'}！
        `.trim();

        try {
          const result = await sendEmail({ to: user.email, subject, text });
          if (result.sent) {
            sent.push(user.email);
          } else {
            failed.push({ email: user.email, error: result.reason || 'skipped' });
          }
        } catch (err) {
          failed.push({ email: user.email, error: err.message });
        }
      }

      return res.status(200).json({ status: 'success', sent, failed, total: store.users.filter((u) => u.isActive !== false).length });
    }

    // POST /api/cron?action=evening-report - Send evening report with task details
    if (action === 'evening-report' && req.method === 'POST') {
      if (!CRON_EMAIL_DELIVERY_ENABLED) {
        return res.status(200).json(buildCronPausedResponse('Evening report emails are temporarily paused.'));
      }

      const store = await ensureDataStore();
      const today = getShanghaiDateString();
      const tomorrow = new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const sent = [];
      const failed = [];

      for (const user of store.users) {
        if (user.isActive === false) continue;

        const userPlans = store.plansByUser[user.id] || [];
        const todayPlans = userPlans.filter((p) => p.date === today);
        const tomorrowPlans = userPlans.filter((p) => p.date === tomorrow);
        
        const completedCount = todayPlans.filter((p) => p.progress === 100 || p.status === 'completed').length;
        const completionRate = todayPlans.length ? Math.round((completedCount / todayPlans.length) * 100) : 0;

        // 分类任务
        const completedTasks = todayPlans.filter((p) => p.progress === 100 || p.status === 'completed');
        const unfinishedTasks = todayPlans.filter((p) => p.progress !== 100 && p.status !== 'completed');
        const urgentTomorrow = tomorrowPlans.filter((p) => p.ddl && p.ddl <= tomorrow);

        const subject = `📊 晚报汇总 - ${today} | 完成率 ${completionRate}%`;
        const text = `
╔════════════════════════════════════════╗
║      ${user.username || '亲爱的用户'}，晚安！ 🌙      ║
╚════════════════════════════════════════╝

📊 【今日完成情况】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 总任务数：${todayPlans.length} 个
• 已完成：${completedCount} 个 ✨
• 完成率：${completionRate}%
• 花费时间：约 ${Math.max(0, userPlans.filter((p) => p.date === today && p.time).length || 0)} 小时

${completedTasks.length > 0 ? `✅ 【今日完成任务】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${completedTasks.slice(0, 10).map((p) => `✓ ${p.event} (${p.person}) - ${p.progress || 100}% 完成`).join('\n')}
${completedTasks.length > 10 ? `  ... 及其他 ${completedTasks.length - 10} 个本` : ''}

` : ''}${unfinishedTasks.length > 0 ? `⚠️ 【未完成任务】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${unfinishedTasks.slice(0, 10).map((p) => `○ ${p.event} (${p.person}) - ${p.progress || 0}% 完成`).join('\n')}
${unfinishedTasks.length > 10 ? `  ... 及其他 ${unfinishedTasks.length - 10} 个未完成项目` : ''}

` : ''}📅 【明日预告】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 明天共有 ${tomorrowPlans.length} 个计划任务
${urgentTomorrow.length > 0 ? `• 紧急任务 ${urgentTomorrow.length} 个（有截止日期）` : '• 暂无特别紧急的任务'}

${tomorrowPlans.slice(0, 5).length > 0 ? `${tomorrowPlans.slice(0, 5).map((p) => `  • ${p.time || '全天'} - ${p.event}`).join('\n')}
${tomorrowPlans.length > 5 ? `  ... 及其他 ${tomorrowPlans.length - 5} 个` : ''}
` : ''}
💤 好好休息，充满精力迎接明天！
晚安，${user.username || '你'}！ 😴
        `.trim();

        try {
          const result = await sendEmail({ to: user.email, subject, text });
          if (result.sent) {
            sent.push(user.email);
          } else {
            failed.push({ email: user.email, error: result.reason || 'skipped' });
          }
        } catch (err) {
          failed.push({ email: user.email, error: err.message });
        }
      }

      return res.status(200).json({ status: 'success', sent, failed, total: store.users.filter((u) => u.isActive !== false).length });
    }

    // POST /api/cron?action=test-daily-digest - Test daily digest for admin
    if (action === 'test-daily-digest' && req.method === 'POST') {
      if (!CRON_EMAIL_DELIVERY_ENABLED) {
        return res.status(200).json(buildCronPausedResponse('Daily digest test emails are temporarily paused.'));
      }

      const auth = await getAuthenticatedUser(req);
      if (!auth || auth.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Admin access required' });
      }

      const store = auth;
      const today = getShanghaiDateString();
      const adminEmail = auth.user.email;
      const sent = [];
      const failed = [];

      try {
        const userPlans = store.plansByUser[auth.user.id] || [];
        const todayPlans = userPlans.filter((p) => p.date === today);
        const completedCount = todayPlans.filter((p) => p.progress === 100 || p.status === 'completed').length;
        const pendingCount = todayPlans.length - completedCount;

        const now = new Date();
        const in6Hours = new Date(now.getTime() + 6 * 60 * 60 * 1000);
        const urgentPlans = todayPlans.filter((p) => {
          if (!p.time) return false;
          const planTime = new Date(`${p.date} ${p.time}`);
          return planTime <= in6Hours && planTime > now;
        }).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

        const subject = `[测试] 📋 今日简报 - ${today} | ${completedCount}/${todayPlans.length} 已完成`;
        const text = `
╔════════════════════════════════════════╗
║         ${auth.user.username || '亲爱的用户'}，早上好！ 📅        ║
╚════════════════════════════════════════╝

📋 【今日任务统计】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 总任务数：${todayPlans.length} 个
• 已完成：${completedCount} 个 ✅
• 待完成：${pendingCount} 个 ⏳
• 完成率：${todayPlans.length ? Math.round((completedCount / todayPlans.length) * 100) : 0}%

${urgentPlans.length > 0 ? `⏰ 【即将截止 (6小时内)】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${urgentPlans.map((p) => `• ${p.time} - ${p.event} (${p.person})`).join('\n')}

` : ''}🌤️ 祝你有一个高效的一天！💪
加油，${auth.user.username || '你'}！
        `.trim();

        const result = await sendEmail({ to: adminEmail, subject, text });
        if (result.sent) {
          sent.push(adminEmail);
        } else {
          failed.push({ email: adminEmail, error: result.reason || 'skipped' });
        }
      } catch (err) {
        failed.push({ email: adminEmail, error: err.message });
      }

      return res.status(200).json({ status: 'success', sent, failed, message: 'Test daily digest sent to admin' });
    }

    // POST /api/cron?action=test-evening-report - Test evening report for admin
    if (action === 'test-evening-report' && req.method === 'POST') {
      if (!CRON_EMAIL_DELIVERY_ENABLED) {
        return res.status(200).json(buildCronPausedResponse('Evening report test emails are temporarily paused.'));
      }

      const auth = await getAuthenticatedUser(req);
      if (!auth || auth.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Admin access required' });
      }

      const store = auth;
      const today = getShanghaiDateString();
      const tomorrow = new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const adminEmail = auth.user.email;
      const sent = [];
      const failed = [];

      try {
        const userPlans = store.plansByUser[auth.user.id] || [];
        const todayPlans = userPlans.filter((p) => p.date === today);
        const tomorrowPlans = userPlans.filter((p) => p.date === tomorrow);

        const completedCount = todayPlans.filter((p) => p.progress === 100 || p.status === 'completed').length;
        const completionRate = todayPlans.length ? Math.round((completedCount / todayPlans.length) * 100) : 0;

        const completedTasks = todayPlans.filter((p) => p.progress === 100 || p.status === 'completed');
        const unfinishedTasks = todayPlans.filter((p) => p.progress !== 100 && p.status !== 'completed');
        const urgentTomorrow = tomorrowPlans.filter((p) => p.ddl && p.ddl <= tomorrow);

        const subject = `[测试] 📊 晚报汇总 - ${today} | 完成率 ${completionRate}%`;
        const text = `
╔════════════════════════════════════════╗
║      ${auth.user.username || '亲爱的用户'}，晚安！ 🌙      ║
╚════════════════════════════════════════╝

📊 【今日完成情况】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 总任务数：${todayPlans.length} 个
• 已完成：${completedCount} 个 ✨
• 完成率：${completionRate}%
• 花费时间：约 ${Math.max(0, userPlans.filter((p) => p.date === today && p.time).length || 0)} 小时

${completedTasks.length > 0 ? `✅ 【今日完成任务】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${completedTasks.slice(0, 10).map((p) => `✓ ${p.event} (${p.person}) - ${p.progress || 100}% 完成`).join('\n')}
${completedTasks.length > 10 ? `  ... 及其他 ${completedTasks.length - 10} 个任务` : ''}

` : ''}${unfinishedTasks.length > 0 ? `⚠️ 【未完成任务】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${unfinishedTasks.slice(0, 10).map((p) => `○ ${p.event} (${p.person}) - ${p.progress || 0}% 完成`).join('\n')}
${unfinishedTasks.length > 10 ? `  ... 及其他 ${unfinishedTasks.length - 10} 个未完成项目` : ''}

` : ''}📅 【明日预告】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 明天共有 ${tomorrowPlans.length} 个计划任务
${urgentTomorrow.length > 0 ? `• 紧急任务 ${urgentTomorrow.length} 个（有截止日期）` : '• 暂无特别紧急的任务'}

${tomorrowPlans.slice(0, 5).length > 0 ? `${tomorrowPlans.slice(0, 5).map((p) => `  • ${p.time || '全天'} - ${p.event}`).join('\n')}
${tomorrowPlans.length > 5 ? `  ... 及其他 ${tomorrowPlans.length - 5} 个` : ''}
` : ''}
💤 好好休息，充满精力迎接明天！
晚安，${auth.user.username || '你'}！ 😴
        `.trim();

        const result = await sendEmail({ to: adminEmail, subject, text });
        if (result.sent) {
          sent.push(adminEmail);
        } else {
          failed.push({ email: adminEmail, error: result.reason || 'skipped' });
        }
      } catch (err) {
        failed.push({ email: adminEmail, error: err.message });
      }

      return res.status(200).json({ status: 'success', sent, failed, message: 'Test evening report sent to admin' });
    }

    // POST /api/cron?action=test-birthday-greetings - Test birthday greeting for admin
    if (action === 'test-birthday-greetings' && req.method === 'POST') {
      if (!CRON_EMAIL_DELIVERY_ENABLED) {
        return res.status(200).json(buildCronPausedResponse('Birthday greeting test emails are temporarily paused.'));
      }

      const auth = await getAuthenticatedUser(req);
      if (!auth || auth.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Admin access required' });
      }

      const adminEmail = auth.user.email;
      const subject = '[测试] 生日快乐！';
      const text = `
${auth.user.username || '朋友'}，生日快乐！

祝你今天开心顺利，计划都能如愿完成。
愿新的一岁平安、健康、灵感满满。

— Day (测试邮件)
      `.trim();

      try {
        const result = await sendEmail({ to: adminEmail, subject, text });
        return res.status(200).json({
          status: 'success',
          message: 'Test birthday greeting sent to admin',
          sent: result.sent ? [adminEmail] : [],
          failed: result.sent ? [] : [{ email: adminEmail, error: result.reason || 'skipped' }],
        });
      } catch (err) {
        return res.status(500).json({
          status: 'error',
          message: err.message,
          failed: [{ email: adminEmail, error: err.message }],
        });
      }
    }

    // Unknown action
    return res.status(400).json({ status: 'error', message: `Unknown cron action: ${action}` });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Cron operation failed' });
  }
}
