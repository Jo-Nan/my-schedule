import { parseJsonBody, requireAuth } from './_lib/auth.js';
import { sendAdminNotificationEmail } from './_lib/email.js';
import { createMessageRecord, getMessages, saveMessages } from './_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const content = (body.content || '').trim();

    if (!content) {
      return res.status(400).json({ status: 'error', message: 'Message content is required' });
    }

    let emailStatus = 'sent';
    let emailError = '';

    try {
      const emailResult = await sendAdminNotificationEmail({
        userEmail: auth.user.email,
        username: auth.user.username || '',
        content,
        createdAt: new Date().toISOString(),
      });

      if (emailResult.skipped) {
        emailStatus = 'skipped';
        emailError = emailResult.reason || '';
      }
    } catch (error) {
      emailStatus = 'failed';
      emailError = error.message || 'Email send failed';
    }

    const message = createMessageRecord({
      userId: auth.user.id,
      userEmail: auth.user.email,
      username: auth.user.username || '',
      content,
      emailStatus,
      emailError,
    });

    auth.messages.push(message);
    await saveMessages(auth.config, auth.messages);

    return res.status(200).json({
      status: 'success',
      message: {
        ...message,
        emailError: undefined,
      },
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message || 'Failed to send message' });
  }
}
