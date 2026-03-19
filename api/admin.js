import { parseJsonBody, requireAdmin } from './_lib/auth.js';
import {
  findUserById,
  findActiveUserByEmail,
  getUserPlans,
  getUserSnapshots,
  createUserRecord,
  publicUser,
  saveUsers,
  savePlansByUser,
  saveSnapshotsByUser,
  ensureDataStore,
  setUserPlans,
  upsertUserSnapshot,
  restoreUserSnapshot,
  getMessages,
  withDataStoreLock,
  assertUserWorkspaceQuota,
} from './_lib/store.js';

const buildBaseUrl = (req) => {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = forwardedHost || req.headers.host || process.env.VERCEL_URL || '';

  if (!host) {
    return '';
  }

  const protocol = forwardedProto || (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${protocol}://${host}`;
};

const normalizeAppUrl = (value = '') => String(value || '').trim().replace(/\/+$/, '');

const summarizeStatus = (statuses) => {
  if (statuses.includes('fail')) {
    return 'fail';
  }
  if (statuses.includes('warn')) {
    return 'warn';
  }
  return 'ok';
};

/**
 * Unified Admin Endpoint
 * Routes:
 * - GET /api/admin?action=users -> List all users
 * - POST /api/admin?action=users -> Create user
 * - DELETE /api/admin?action=users&id=userId -> Delete user
 * - POST /api/admin?action=restore-user&id=userId -> Restore user
 * - GET /api/admin?action=user-plans&userId=xxx -> Get user's plans
 * - POST /api/admin?action=user-plans&userId=xxx -> Save user's plans
 * - GET /api/admin?action=user-snapshots&id=xxx -> Get user's snapshots
 * - POST /api/admin?action=restore-snapshot -> Restore user's snapshot
 * - GET /api/admin?action=messages -> Get all messages
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const auth = await requireAdmin(req, res);
  if (!auth) {
    return;
  }

  const action = req.query.action || '';

  try {
    // GET /api/admin?action=users - List all users
    if (req.method === 'GET' && action === 'users') {
      const users = auth.users
        .map((user) => ({
          ...publicUser(user),
          planCount: getUserPlans(auth.plansByUser, user.id).length,
        }))
        .sort((left, right) => {
          if (left.role !== right.role) {
            return left.role === 'admin' ? -1 : 1;
          }
          return left.createdAt.localeCompare(right.createdAt);
        });

      return res.status(200).json({ status: 'success', users });
    }

    // GET /api/admin?action=self-check - Check runtime config completeness
    if (req.method === 'GET' && action === 'self-check') {
      const detectedBaseUrl = buildBaseUrl(req);
      const inferredRuntimeUrl = normalizeAppUrl(
        process.env.APP_URL
        || process.env.SITE_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
        || detectedBaseUrl
      );
      const mailFrom = process.env.MAIL_FROM || process.env.RESEND_FROM || '';
      const emailStatus = process.env.RESEND_API_KEY && mailFrom ? 'ok' : 'fail';
      const storageStatus = auth.config.mode === 'github'
        ? (auth.config.token && auth.config.owner && auth.config.repo ? 'ok' : 'fail')
        : 'warn';
      const cronStatus = detectedBaseUrl ? (inferredRuntimeUrl ? 'warn' : 'warn') : 'fail';
      const backupStatus = auth.config.mode === 'github' ? 'ok' : 'warn';

      const checks = {
        email: {
          status: emailStatus,
          provider: 'Resend',
          apiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
          senderConfigured: Boolean(mailFrom),
          senderAddress: mailFrom || null,
          details: emailStatus === 'ok'
            ? 'Runtime email settings look complete.'
            : 'Missing RESEND_API_KEY or MAIL_FROM/RESEND_FROM.',
        },
        cron: {
          status: cronStatus,
          detectedBaseUrl: detectedBaseUrl || null,
          suggestedCronApiUrl: detectedBaseUrl ? `${detectedBaseUrl}/api/cron` : null,
          runtimeAppUrl: inferredRuntimeUrl || null,
          workflowFilesPresent: true,
          details: detectedBaseUrl
            ? 'GitHub Actions APP_URL secret cannot be read from runtime. Make sure it matches the detected base URL.'
            : 'Could not infer the current runtime host, so the cron target URL could not be verified.',
        },
        storage: {
          status: storageStatus,
          mode: auth.config.mode,
          githubConfigured: auth.config.mode === 'github',
          usersPath: auth.config.usersPath,
          plansPath: auth.config.userPlansPath,
          snapshotsPath: auth.config.snapshotsPath,
          messagesPath: auth.config.messagesPath,
          details: auth.config.mode === 'github'
            ? 'Persistent multi-user storage is backed by GitHub JSON files.'
            : 'Storage is currently local. That is okay for local development but risky for deployed persistence.',
        },
        backup: {
          status: backupStatus,
          architecture: 'backups/multi-user/YYYYMMDD/{users,plans-by-user,plan-snapshots,messages,manifest}.json',
          sourcePaths: [
            auth.config.usersPath,
            auth.config.userPlansPath,
            auth.config.snapshotsPath,
            auth.config.messagesPath,
          ],
          details: auth.config.mode === 'github'
            ? 'Daily backup workflow is designed for the multi-user GitHub data store.'
            : 'Backup workflow is intended for GitHub-backed storage and may not reflect local-only runtime data.',
        },
      };

      const overall = summarizeStatus(Object.values(checks).map((item) => item.status));
      return res.status(200).json({
        status: 'success',
        overall,
        checkedAt: new Date().toISOString(),
        checks,
      });
    }

    // POST /api/admin?action=users - Create user
    if (req.method === 'POST' && action === 'users') {
      const body = await parseJsonBody(req);
      const email = (body.email || '').trim();
      const password = body.password || '';
      const username = (body.username || '').trim();
      const role = body.role === 'admin' ? 'admin' : 'user';

      if (!email || !password) {
        return res.status(400).json({ status: 'error', message: 'Email and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
      }

      return withDataStoreLock(async () => {
        const store = await ensureDataStore();
        const existingUser = findActiveUserByEmail(store.users, email);
        if (existingUser) {
          return res.status(409).json({ status: 'error', message: 'Email is already registered' });
        }

        const user = createUserRecord({ email, username, password, role });
        store.users.push(user);
        store.plansByUser[user.id] = [];

        await saveUsers(store.config, store.users);
        await savePlansByUser(store.config, store.plansByUser);

        return res.status(201).json({ status: 'success', user: publicUser(user) });
      });
    }

    // DELETE /api/admin?action=users&id=userId - Delete user
    if (req.method === 'DELETE' && action === 'users') {
      const userId = String(req.query.id || '');
      return withDataStoreLock(async () => {
        const store = await ensureDataStore();
        const targetUser = store.users.find((user) => user.id === userId);

        if (!targetUser) {
          return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        if (targetUser.role === 'admin') {
          return res.status(400).json({ status: 'error', message: 'Admin user cannot be deleted' });
        }

        targetUser.isActive = false;
        targetUser.updatedAt = new Date().toISOString();

        await saveUsers(store.config, store.users);
        return res.status(200).json({ status: 'success' });
      });
    }

    // POST /api/admin?action=restore-user&id=userId - Restore user
    if (req.method === 'POST' && action === 'restore-user') {
      const userId = String(req.query.id || '');
      return withDataStoreLock(async () => {
        const store = await ensureDataStore();
        const targetUser = store.users.find((user) => user.id === userId);

        if (!targetUser) {
          return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        if (targetUser.isActive !== false) {
          return res.status(400).json({ status: 'error', message: 'User is already active' });
        }

        const activeDuplicate = findActiveUserByEmail(store.users, targetUser.email);
        if (activeDuplicate && activeDuplicate.id !== targetUser.id) {
          return res.status(409).json({
            status: 'error',
            message: 'Another active user already uses this email. Deactivate or delete that active account before restoring this user.',
          });
        }

        targetUser.isActive = true;
        targetUser.updatedAt = new Date().toISOString();

        await saveUsers(store.config, store.users);
        return res.status(200).json({ status: 'success' });
      });
    }

    // GET /api/admin?action=user-plans&userId=xxx - Get user's plans
    if (req.method === 'GET' && action === 'user-plans') {
      const userId = String(req.query.userId || '');
      const user = findUserById(auth.users, userId);

      if (!user || user.isActive === false) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      return res.status(200).json({
        status: 'success',
        user: publicUser(user),
        plans: getUserPlans(auth.plansByUser, user.id),
      });
    }

    // POST /api/admin?action=user-plans&userId=xxx - Save user's plans
    if (req.method === 'POST' && action === 'user-plans') {
      const body = await parseJsonBody(req);
      const userId = String(body.userId || req.query.userId || '');
      const plans = body.plans;
      const user = findUserById(auth.users, userId);

      if (!user || user.isActive === false) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      if (!Array.isArray(plans)) {
        return res.status(400).json({ status: 'error', message: 'Plans must be an array' });
      }

      assertUserWorkspaceQuota({
        users: auth.users,
        plansByUser: auth.plansByUser,
        mapsByUser: auth.mapsByUser,
        userId,
        nextPlans: plans,
      });

      const savedPlans = setUserPlans(auth.plansByUser, userId, plans);
      upsertUserSnapshot(auth.snapshotsByUser, userId, savedPlans, 'admin_save');
      await savePlansByUser(auth.config, auth.plansByUser);
      await saveSnapshotsByUser(auth.config, auth.snapshotsByUser);

      return res.status(200).json({
        status: 'success',
        user: publicUser(user),
        count: savedPlans.length,
      });
    }

    // GET /api/admin?action=user-snapshots&id=xxx - Get user's snapshots
    if (req.method === 'GET' && action === 'user-snapshots') {
      const userId = String(req.query.id || '');
      const user = findUserById(auth.users, userId);

      if (!user || user.isActive === false) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      const snapshots = getUserSnapshots(auth.snapshotsByUser, user.id).map((snapshot) => ({
        id: snapshot.id,
        snapshotDate: snapshot.snapshotDate,
        createdAt: snapshot.createdAt,
        source: snapshot.source,
        planCount: snapshot.plans.length,
      }));

      return res.status(200).json({
        status: 'success',
        user: publicUser(user),
        snapshots,
      });
    }

    // POST /api/admin?action=restore-snapshot - Restore user's snapshot
    if (req.method === 'POST' && action === 'restore-snapshot') {
      const body = await parseJsonBody(req);
      const userId = String(body.userId || '');
      const snapshotId = String(body.snapshotId || '');
      const user = findUserById(auth.users, userId);

      if (!user || user.isActive === false) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      const targetSnapshot = getUserSnapshots(auth.snapshotsByUser, userId).find((item) => item.id === snapshotId);
      if (!targetSnapshot) {
        return res.status(404).json({ status: 'error', message: 'Snapshot not found' });
      }

      assertUserWorkspaceQuota({
        users: auth.users,
        plansByUser: auth.plansByUser,
        mapsByUser: auth.mapsByUser,
        userId,
        nextPlans: targetSnapshot.plans,
      });

      upsertUserSnapshot(auth.snapshotsByUser, userId, auth.plansByUser[userId] || [], 'pre_restore');
      const restoredSnapshot = restoreUserSnapshot(auth.plansByUser, auth.snapshotsByUser, userId, snapshotId);

      if (!restoredSnapshot) {
        return res.status(404).json({ status: 'error', message: 'Snapshot not found' });
      }

      upsertUserSnapshot(auth.snapshotsByUser, userId, auth.plansByUser[userId] || [], 'restore');
      await savePlansByUser(auth.config, auth.plansByUser);
      await saveSnapshotsByUser(auth.config, auth.snapshotsByUser);

      return res.status(200).json({ status: 'success', snapshot: restoredSnapshot });
    }

    // GET /api/admin?action=messages - Get all messages
    if (req.method === 'GET' && action === 'messages') {
      return res.status(200).json({
        status: 'success',
        messages: getMessages(auth.messages),
      });
    }

    // Unknown action or method
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(400).json({ status: 'error', message: `Unknown admin action or method: ${action} ${req.method}` });
  } catch (error) {
    if (error?.code === 'USER_STORAGE_LIMIT_EXCEEDED') {
      const limitMB = (Number(error.limitBytes) / (1024 * 1024)).toFixed(0);
      const totalMB = (Number(error.totalBytes) / (1024 * 1024)).toFixed(2);
      return res.status(400).json({
        status: 'error',
        code: error.code,
        message: `普通用户总数据不能超过 ${limitMB}MB（含日程与地图）。当前约 ${totalMB}MB，请精简后再保存。`,
      });
    }
    return res.status(500).json({ status: 'error', message: error.message || 'Admin operation failed' });
  }
}
