import { requireAuth, parseJsonBody } from './_lib/auth.js';
import { getUserPlans, setUserPlans, savePlansByUser, saveSnapshotsByUser, upsertUserSnapshot } from './_lib/store.js';

/**
 * Unified Plans Endpoint
 * Routes:
 * - GET /api/plans -> Load user plans
 * - POST /api/plans -> Save user plans
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    // GET /api/plans - Load plans
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

  if (req.method === 'POST') {
    // POST /api/plans - Save plans
    const auth = await requireAuth(req, res);
    if (!auth) {
      return;
    }

    try {
      const plans = await parseJsonBody(req);

      if (!Array.isArray(plans)) {
        return res.status(400).json({
          status: 'error',
          message: 'Request body must be a JSON array of plans',
        });
      }

      const savedPlans = setUserPlans(auth.plansByUser, auth.user.id, plans);
      upsertUserSnapshot(auth.snapshotsByUser, auth.user.id, savedPlans, 'save');
      await savePlansByUser(auth.config, auth.plansByUser);
      await saveSnapshotsByUser(auth.config, auth.snapshotsByUser);

      return res.status(200).json({
        status: 'success',
        source: auth.config.mode,
        user: auth.safeUser,
        count: savedPlans.length,
      });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Unexpected error while saving plans',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ status: 'error', message: 'Method not allowed' });
}
