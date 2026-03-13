import { requireAdmin } from '../_lib/auth.js';
import { getMessages } from '../_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) {
    return;
  }

  return res.status(200).json({
    status: 'success',
    messages: getMessages(auth.messages),
  });
}
