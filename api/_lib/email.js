const resendApiUrl = 'https://api.resend.com/emails';
const EMAIL_DELIVERY_ENABLED = false;

const sendEmail = async ({ to, subject, text }) => {
  if (!EMAIL_DELIVERY_ENABLED) {
    return {
      sent: false,
      skipped: true,
      reason: 'Email delivery disabled in privacy mode',
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

export const sendAdminNotificationEmail = async ({ userEmail, username, content, createdAt }) => {
  const adminEmail = process.env.ADMIN_EMAIL || 'nanqiao.ai@gmail.com';
  const displayName = username || '未填写用户名';
  const timeText = createdAt || new Date().toISOString();

  return sendEmail({
    to: adminEmail,
    subject: `Day 用户消息通知 - ${userEmail}`,
    text: [
      '你收到一条新的用户消息。',
      '',
      `用户邮箱: ${userEmail}`,
      `用户名: ${displayName}`,
      `发送时间: ${timeText}`,
      '',
      '消息内容:',
      content,
    ].join('\n'),
  });
};

export const sendResetCodeEmail = async ({ email, code }) => {
  return sendEmail({
    to: email,
    subject: 'Day 密码重置验证码',
    text: [
      '你正在重置 Day 账号密码。',
      '',
      `验证码: ${code}`,
      '验证码 10 分钟内有效。',
      '如果不是你本人操作，请忽略此邮件。',
    ].join('\n'),
  });
};

export const sendBirthdayGreetingEmail = async ({ email, username }) => {
  const displayName = username || '朋友';
  return sendEmail({
    to: email,
    subject: '生日快乐！',
    text: [
      `${displayName}，生日快乐！`,
      '',
      '祝你今天开心顺利，计划都能如愿完成。',
      '愿新的一岁平安、健康、灵感满满。',
      '',
      '— Day',
    ].join('\n'),
  });
};
