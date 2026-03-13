import { getAuthenticatedUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  return res.status(200).json({ status: 'success', user: auth.safeUser });
}
