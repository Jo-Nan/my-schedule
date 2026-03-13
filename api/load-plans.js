import { requireAuth } from './_lib/auth.js';
import { getUserPlans } from './_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }

  const plans = getUserPlans(auth.plansByUser, auth.user.id);

  return res.status(200).json({
    status: 'success',
    source: auth.config.mode,
    user: auth.safeUser,
    data: plans,
  });
}
