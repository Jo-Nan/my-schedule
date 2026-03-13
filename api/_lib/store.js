import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_VERSION = '2022-11-28';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const LOCAL_DATA_DIR = path.join(PROJECT_ROOT, '.local-data');

const ADMIN_SEED = {
  id: 'admin-nanmuz',
  username: 'NanMuZ',
  email: 'nanqiao.ai@gmail.com',
  password: '571428',
  role: 'admin',
};

export const normalizeEmail = (value = '') => value.trim().toLowerCase();

export const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username || '',
  role: user.role || 'user',
  isActive: user.isActive !== false,
  createdAt: user.createdAt || null,
  updatedAt: user.updatedAt || null,
});

export const createUserId = () => `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('base64url');
  const iterations = 120000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64url');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
};

export const verifyPassword = (password, passwordHash = '') => {
  const [scheme, iterText, salt, hash] = passwordHash.split('$');
  if (scheme !== 'pbkdf2' || !iterText || !salt || !hash) {
    return false;
  }

  const derived = crypto.pbkdf2Sync(password, salt, Number(iterText), 32, 'sha256');
  const expected = Buffer.from(hash, 'base64url');

  if (derived.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(derived, expected);
};

const sanitizePlan = (plan = {}) => ({
  id: String(plan.id || `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`),
  event: typeof plan.event === 'string' ? plan.event : '',
  date: typeof plan.date === 'string' ? plan.date : '',
  time: typeof plan.time === 'string' ? plan.time : '',
  person: typeof plan.person === 'string' ? plan.person : '',
  ddl: typeof plan.ddl === 'string' ? plan.ddl : '',
  progress: Number.isFinite(plan.progress) ? plan.progress : 0,
  status: typeof plan.status === 'string' ? plan.status : 'uncompleted',
  updatedAt: Number.isFinite(plan.updatedAt) ? plan.updatedAt : Date.now(),
});

const sanitizePlans = (plans) => (Array.isArray(plans) ? plans.map(sanitizePlan) : []);

const sanitizeSnapshot = (snapshot = {}) => ({
  id: String(snapshot.id || `snapshot_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`),
  snapshotDate: typeof snapshot.snapshotDate === 'string' ? snapshot.snapshotDate : getShanghaiDateString(),
  createdAt: typeof snapshot.createdAt === 'string' ? snapshot.createdAt : new Date().toISOString(),
  source: typeof snapshot.source === 'string' ? snapshot.source : 'manual',
  plans: sanitizePlans(snapshot.plans),
});

const sanitizeSnapshots = (snapshots) => (Array.isArray(snapshots) ? snapshots.map(sanitizeSnapshot) : []);

export const getShanghaiDateString = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
};

const getStorageConfig = () => {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (token && owner && repo) {
    return {
      mode: 'github',
      token,
      owner,
      repo,
      branch: process.env.GITHUB_BRANCH || 'main',
      usersPath: process.env.GITHUB_USERS_PATH || 'data/users.json',
      userPlansPath: process.env.GITHUB_USER_PLANS_PATH || 'data/plans-by-user.json',
      snapshotsPath: process.env.GITHUB_SNAPSHOTS_PATH || 'data/plan-snapshots.json',
      legacyPlansPath: process.env.GITHUB_PLANS_PATH || 'data/plans.json',
    };
  }

  return {
    mode: 'local',
    usersPath: path.join(LOCAL_DATA_DIR, 'users.json'),
    userPlansPath: path.join(LOCAL_DATA_DIR, 'plans-by-user.json'),
    snapshotsPath: path.join(LOCAL_DATA_DIR, 'plan-snapshots.json'),
    legacyPlansPath: path.join(PROJECT_ROOT, 'public', 'data', 'plans.json'),
  };
};

const githubHeaders = (token) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': API_VERSION,
});

const buildGithubContentsUrl = ({ owner, repo, branch }, filePath) => {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
};

const buildGithubWriteUrl = ({ owner, repo }, filePath) => {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
};

const readGithubJson = async (config, filePath, fallbackValue) => {
  const response = await fetch(buildGithubContentsUrl(config, filePath), {
    headers: githubHeaders(config.token),
  });

  if (response.status === 404) {
    return { data: fallbackValue, sha: null, exists: false };
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to read ${filePath} from GitHub: ${details}`);
  }

  const payload = await response.json();
  const raw = Buffer.from((payload.content || '').replace(/\n/g, ''), 'base64').toString('utf-8');
  return {
    data: JSON.parse(raw || 'null') ?? fallbackValue,
    sha: payload.sha || null,
    exists: true,
  };
};

const writeGithubJson = async (config, filePath, data, message) => {
  const current = await readGithubJson(config, filePath, null);
  const payload = {
    message,
    content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`, 'utf-8').toString('base64'),
    branch: config.branch,
  };

  if (current.sha) {
    payload.sha = current.sha;
  }

  const response = await fetch(buildGithubWriteUrl(config, filePath), {
    method: 'PUT',
    headers: {
      ...githubHeaders(config.token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to write ${filePath} to GitHub: ${details}`);
  }
};

const ensureLocalDir = async () => {
  await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
};

const readLocalJson = async (filePath, fallbackValue) => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return { data: JSON.parse(raw), sha: null, exists: true };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { data: fallbackValue, sha: null, exists: false };
    }
    throw error;
  }
};

const writeLocalJson = async (filePath, data) => {
  await ensureLocalDir();
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
};

const readJson = async (config, filePath, fallbackValue) => {
  if (config.mode === 'github') {
    return readGithubJson(config, filePath, fallbackValue);
  }
  return readLocalJson(filePath, fallbackValue);
};

const writeJson = async (config, filePath, data, message) => {
  if (config.mode === 'github') {
    return writeGithubJson(config, filePath, data, message);
  }
  return writeLocalJson(filePath, data);
};

const readLegacyPlans = async (config) => {
  try {
    const result = await readJson(config, config.legacyPlansPath, []);
    return sanitizePlans(result.data);
  } catch {
    return [];
  }
};

const withUserMaps = (store) => {
  for (const user of store.users) {
    if (!Array.isArray(store.plansByUser[user.id])) {
      store.plansByUser[user.id] = [];
    }
    if (!Array.isArray(store.snapshotsByUser[user.id])) {
      store.snapshotsByUser[user.id] = [];
    }
  }
};

export const ensureDataStore = async () => {
  const config = getStorageConfig();
  const usersResult = await readJson(config, config.usersPath, []);
  const plansResult = await readJson(config, config.userPlansPath, {});
  const snapshotsResult = await readJson(config, config.snapshotsPath, {});

  const users = Array.isArray(usersResult.data) ? usersResult.data : [];
  const plansByUser = plansResult.data && typeof plansResult.data === 'object' && !Array.isArray(plansResult.data)
    ? plansResult.data
    : {};
  const snapshotsByUser = snapshotsResult.data && typeof snapshotsResult.data === 'object' && !Array.isArray(snapshotsResult.data)
    ? snapshotsResult.data
    : {};

  let changed = false;
  let admin = users.find((user) => normalizeEmail(user.email) === ADMIN_SEED.email);

  if (!admin) {
    admin = {
      id: ADMIN_SEED.id,
      email: ADMIN_SEED.email,
      username: ADMIN_SEED.username,
      passwordHash: hashPassword(ADMIN_SEED.password),
      role: ADMIN_SEED.role,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(admin);
    changed = true;
  }

  if (!Array.isArray(plansByUser[admin.id])) {
    const hasAnyPlans = Object.values(plansByUser).some((value) => Array.isArray(value) && value.length > 0);
    plansByUser[admin.id] = hasAnyPlans ? [] : await readLegacyPlans(config);
    changed = true;
  }

  for (const user of users) {
    plansByUser[user.id] = sanitizePlans(plansByUser[user.id]);
    snapshotsByUser[user.id] = sanitizeSnapshots(snapshotsByUser[user.id]);
  }

  withUserMaps({ users, plansByUser, snapshotsByUser });

  if (!snapshotsByUser[admin.id]?.length && plansByUser[admin.id]?.length) {
    snapshotsByUser[admin.id] = [
      sanitizeSnapshot({
        snapshotDate: getShanghaiDateString(),
        createdAt: new Date().toISOString(),
        source: 'migration',
        plans: plansByUser[admin.id],
      }),
    ];
    changed = true;
  }

  if (changed) {
    await writeJson(config, config.usersPath, users, 'Initialize day users');
    await writeJson(config, config.userPlansPath, plansByUser, 'Initialize day user plans');
    await writeJson(config, config.snapshotsPath, snapshotsByUser, 'Initialize day user snapshots');
  }

  return { config, users, plansByUser, snapshotsByUser };
};

export const saveUsers = async (config, users) => {
  await writeJson(config, config.usersPath, users, 'Update day users');
};

export const savePlansByUser = async (config, plansByUser) => {
  await writeJson(config, config.userPlansPath, plansByUser, 'Update day user plans');
};

export const saveSnapshotsByUser = async (config, snapshotsByUser) => {
  await writeJson(config, config.snapshotsPath, snapshotsByUser, 'Update day user snapshots');
};

export const findUserByEmail = (users, email) => users.find((user) => normalizeEmail(user.email) === normalizeEmail(email));

export const findUserById = (users, userId) => users.find((user) => user.id === userId);

export const createUserRecord = ({ email, username = '', password, role = 'user' }) => {
  const now = new Date().toISOString();
  return {
    id: createUserId(),
    email: normalizeEmail(email),
    username: (username || '').trim(),
    passwordHash: hashPassword(password),
    role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
};

export const getUserPlans = (plansByUser, userId) => sanitizePlans(plansByUser[userId] || []);

export const setUserPlans = (plansByUser, userId, plans) => {
  plansByUser[userId] = sanitizePlans(plans);
  return plansByUser[userId];
};

export const getUserSnapshots = (snapshotsByUser, userId) => sanitizeSnapshots(snapshotsByUser[userId] || []);

export const upsertUserSnapshot = (snapshotsByUser, userId, plans, source = 'save') => {
  const snapshotDate = getShanghaiDateString();
  const snapshot = sanitizeSnapshot({
    snapshotDate,
    createdAt: new Date().toISOString(),
    source,
    plans,
  });
  const current = getUserSnapshots(snapshotsByUser, userId).filter((item) => item.snapshotDate !== snapshotDate);
  snapshotsByUser[userId] = [snapshot, ...current].sort((left, right) => right.snapshotDate.localeCompare(left.snapshotDate));
  return snapshot;
};

export const restoreUserSnapshot = (plansByUser, snapshotsByUser, userId, snapshotId) => {
  const snapshots = getUserSnapshots(snapshotsByUser, userId);
  const snapshot = snapshots.find((item) => item.id === snapshotId);
  if (!snapshot) {
    return null;
  }
  plansByUser[userId] = sanitizePlans(snapshot.plans);
  return snapshot;
};
