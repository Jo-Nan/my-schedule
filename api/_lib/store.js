import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_VERSION = '2022-11-28';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const LOCAL_DATA_DIR = path.join(PROJECT_ROOT, '.local-data');
let dataStoreMutationQueue = Promise.resolve();
export const NORMAL_USER_STORAGE_LIMIT_BYTES = 15 * 1024 * 1024;

const ADMIN_SEED = {
  id: 'admin-nanmuz',
  username: 'NanMuZ',
  email: 'nanqiao.ai@gmail.com',
  password: 'u7P#m2S9',
  role: 'admin',
};

export const normalizeEmail = (value = '') => value.trim().toLowerCase();

const slugifyIdPart = (value = '', fallback = 'na') => {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/@/g, '-at-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
};

const compactTimestamp = (value) => {
  const date = value ? new Date(value) : new Date();
  const stamp = Number.isNaN(date.getTime()) ? new Date() : date;
  return stamp.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
};

export const createManagementUserId = ({ email = '', username = '', createdAt = '' } = {}) => {
  const emailPart = slugifyIdPart(normalizeEmail(email), 'email');
  const usernamePart = slugifyIdPart(username || 'nouser', 'nouser');
  const createdPart = compactTimestamp(createdAt);
  const randomPart = crypto.randomBytes(3).toString('hex');
  return `${emailPart}__${usernamePart}__${createdPart}__${randomPart}`;
};

export const publicUser = (user) => ({
  id: user.id,
  managementId: user.managementId || '',
  email: user.email,
  username: user.username || '',
  role: user.role || 'user',
  birthday: user.birthday || '',
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

export const hashResetCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

export const generateResetCode = () => String(Math.floor(100000 + Math.random() * 900000));

const sanitizeAttachment = (attachment = {}) => ({
  id: String(attachment.id || `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`),
  name: typeof attachment.name === 'string' ? attachment.name : '',
  url: typeof attachment.url === 'string' ? attachment.url : '',
  pathname: typeof attachment.pathname === 'string' ? attachment.pathname : '',
  size: Number.isFinite(attachment.size) ? Math.max(0, Math.round(attachment.size)) : 0,
  contentType: typeof attachment.contentType === 'string' ? attachment.contentType : '',
  uploadedAt: typeof attachment.uploadedAt === 'string' ? attachment.uploadedAt : new Date().toISOString(),
});

const sanitizeAttachments = (attachments) => (
  Array.isArray(attachments)
    ? attachments
      .map(sanitizeAttachment)
      .filter((attachment) => attachment.url)
    : []
);

const sanitizePlan = (plan = {}) => ({
  id: String(plan.id || `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`),
  event: typeof plan.event === 'string' ? plan.event : '',
  date: typeof plan.date === 'string' ? plan.date : '',
  time: typeof plan.time === 'string' ? plan.time : '',
  person: typeof plan.person === 'string' ? plan.person : '',
  ddl: typeof plan.ddl === 'string' ? plan.ddl : '',
  details: typeof plan.details === 'string' ? plan.details : '',
  attachments: sanitizeAttachments(plan.attachments),
  progress: Number.isFinite(plan.progress) ? plan.progress : 0,
  status: typeof plan.status === 'string' ? plan.status : 'uncompleted',
  sortOrder: Number.isFinite(plan.sortOrder) ? Math.round(plan.sortOrder) : null,
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

const sanitizeMessage = (message = {}) => ({
  id: String(message.id || `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`),
  userId: String(message.userId || ''),
  userEmail: typeof message.userEmail === 'string' ? message.userEmail : '',
  username: typeof message.username === 'string' ? message.username : '',
  content: typeof message.content === 'string' ? message.content : '',
  createdAt: typeof message.createdAt === 'string' ? message.createdAt : new Date().toISOString(),
  emailStatus: typeof message.emailStatus === 'string' ? message.emailStatus : 'pending',
  emailError: typeof message.emailError === 'string' ? message.emailError : '',
});

const sanitizeMessages = (messages) => (Array.isArray(messages) ? messages.map(sanitizeMessage) : []);

const sanitizeMapRecycleBin = (recycleBin) => (
  Array.isArray(recycleBin)
    ? recycleBin
      .map((item) => ({
        id: typeof item?.id === 'string' ? item.id : `recycle_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        kind: ['point', 'photo', 'user'].includes(item?.kind) ? item.kind : 'point',
        deletedAt: typeof item?.deletedAt === 'string' ? item.deletedAt : new Date().toISOString(),
        title: typeof item?.title === 'string' ? item.title : '',
        payload: item?.payload && typeof item.payload === 'object' && !Array.isArray(item.payload) ? item.payload : {},
      }))
    : []
);

const sanitizeMapShare = (share = {}) => ({
  enabled: share?.enabled === true,
  token: typeof share?.token === 'string' ? share.token.trim() : '',
});

const sanitizeMapPlaceBookmarks = (places, maxSize = 20) => {
  const list = Array.isArray(places) ? places : [];
  const seen = new Set();
  const output = [];

  for (const item of list) {
    const latitude = Number.parseFloat(item?.latitude);
    const longitude = Number.parseFloat(item?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }
    const name = typeof item?.name === 'string' && item.name.trim()
      ? item.name.trim()
      : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    const key = `${name.toLowerCase()}__${latitude.toFixed(4)}__${longitude.toFixed(4)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push({
      id: typeof item?.id === 'string' ? item.id : `place_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      name,
      latitude: Math.max(-90, Math.min(90, latitude)),
      longitude: Math.max(-180, Math.min(180, longitude)),
    });
    if (output.length >= maxSize) {
      break;
    }
  }

  return output;
};

const sanitizeMapWorkspace = (workspace = {}) => {
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) {
    return {
      scope: 'china',
      showFeaturedBubbles: true,
      bubbleLayout: 'map',
      users: [],
      points: [],
      searchHistory: [],
      favoritePlaces: [],
      recycleBin: [],
      share: sanitizeMapShare(),
      revision: 0,
      savedAt: new Date().toISOString(),
    };
  }

  const rawRevision = Number.isFinite(workspace.revision) ? workspace.revision : Number.parseInt(workspace.revision, 10);

  return {
    scope: workspace.scope === 'world' ? 'world' : 'china',
    showFeaturedBubbles: workspace.showFeaturedBubbles !== false,
    bubbleLayout: ['map', 'right', 'bottom', 'freestyle'].includes(workspace.bubbleLayout) ? workspace.bubbleLayout : 'map',
    users: Array.isArray(workspace.users) ? workspace.users : [],
    points: Array.isArray(workspace.points) ? workspace.points : [],
    searchHistory: sanitizeMapPlaceBookmarks(workspace.searchHistory, 12),
    favoritePlaces: sanitizeMapPlaceBookmarks(workspace.favoritePlaces, 16),
    recycleBin: sanitizeMapRecycleBin(workspace.recycleBin),
    share: sanitizeMapShare(workspace.share),
    revision: Number.isInteger(rawRevision) && rawRevision >= 0 ? rawRevision : 0,
    savedAt: typeof workspace.savedAt === 'string' ? workspace.savedAt : new Date().toISOString(),
  };
};

const estimateJsonBytes = (value) => Buffer.byteLength(JSON.stringify(value ?? null), 'utf-8');

const sanitizeUser = (user = {}) => {
  const createdAt = typeof user.createdAt === 'string' ? user.createdAt : new Date().toISOString();
  const email = normalizeEmail(user.email || '');
  const username = typeof user.username === 'string' ? user.username.trim() : '';

  return {
    id: String(user.id || createUserId()),
    managementId: typeof user.managementId === 'string' && user.managementId.trim()
      ? user.managementId.trim()
      : createManagementUserId({ email, username, createdAt }),
    email,
    username,
    passwordHash: typeof user.passwordHash === 'string' ? user.passwordHash : '',
    role: user.role === 'admin' ? 'admin' : 'user',
    birthday: typeof user.birthday === 'string' ? user.birthday : '',
    resetCodeHash: typeof user.resetCodeHash === 'string' ? user.resetCodeHash : '',
    resetCodeExpiresAt: typeof user.resetCodeExpiresAt === 'string' ? user.resetCodeExpiresAt : '',
    lastBirthdayGreetingYear: typeof user.lastBirthdayGreetingYear === 'string' ? user.lastBirthdayGreetingYear : '',
    isActive: user.isActive !== false,
    createdAt,
    updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : new Date().toISOString(),
  };
};

export const getShanghaiDateString = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
};

export const isValidBirthday = (value = '') => /^\d{4}-\d{2}-\d{2}$/.test(value);

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
      messagesPath: process.env.GITHUB_MESSAGES_PATH || 'data/messages.json',
      mapsPath: process.env.GITHUB_MAPS_PATH || 'data/map-by-user.json',
      legacyPlansPath: process.env.GITHUB_PLANS_PATH || 'data/plans.json',
    };
  }

  return {
    mode: 'local',
    usersPath: path.join(LOCAL_DATA_DIR, 'users.json'),
    userPlansPath: path.join(LOCAL_DATA_DIR, 'plans-by-user.json'),
    snapshotsPath: path.join(LOCAL_DATA_DIR, 'plan-snapshots.json'),
    messagesPath: path.join(LOCAL_DATA_DIR, 'messages.json'),
    mapsPath: path.join(LOCAL_DATA_DIR, 'map-by-user.json'),
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
    if (!store.mapsByUser[user.id] || typeof store.mapsByUser[user.id] !== 'object') {
      store.mapsByUser[user.id] = sanitizeMapWorkspace();
    }
  }
};

export const ensureDataStore = async () => {
  const config = getStorageConfig();
  const usersResult = await readJson(config, config.usersPath, []);
  const plansResult = await readJson(config, config.userPlansPath, {});
  const snapshotsResult = await readJson(config, config.snapshotsPath, {});
  const messagesResult = await readJson(config, config.messagesPath, []);
  const mapsResult = await readJson(config, config.mapsPath, {});

  const rawUsers = Array.isArray(usersResult.data) ? usersResult.data : [];
  const users = rawUsers.map(sanitizeUser);
  const plansByUser = plansResult.data && typeof plansResult.data === 'object' && !Array.isArray(plansResult.data)
    ? plansResult.data
    : {};
  const snapshotsByUser = snapshotsResult.data && typeof snapshotsResult.data === 'object' && !Array.isArray(snapshotsResult.data)
    ? snapshotsResult.data
    : {};
  const messages = sanitizeMessages(messagesResult.data);
  const mapsByUser = mapsResult.data && typeof mapsResult.data === 'object' && !Array.isArray(mapsResult.data)
    ? mapsResult.data
    : {};

  let changed = false;
  let admin = users.find((user) => normalizeEmail(user.email) === ADMIN_SEED.email);

  if (rawUsers.some((user) => !(typeof user?.managementId === 'string' && user.managementId.trim()))) {
    changed = true;
  }

  if (!admin) {
    admin = sanitizeUser({
      id: ADMIN_SEED.id,
      email: ADMIN_SEED.email,
      username: ADMIN_SEED.username,
      passwordHash: hashPassword(ADMIN_SEED.password),
      role: ADMIN_SEED.role,
      isActive: true,
    });
    users.push(admin);
    changed = true;
  } else {
    if (admin.username !== ADMIN_SEED.username) {
      admin.username = ADMIN_SEED.username;
      changed = true;
    }
    if (admin.role !== ADMIN_SEED.role) {
      admin.role = ADMIN_SEED.role;
      changed = true;
    }
    if (!verifyPassword(ADMIN_SEED.password, admin.passwordHash)) {
      admin.passwordHash = hashPassword(ADMIN_SEED.password);
      admin.updatedAt = new Date().toISOString();
      changed = true;
    }
  }

  if (!Array.isArray(plansByUser[admin.id])) {
    const hasAnyPlans = Object.values(plansByUser).some((value) => Array.isArray(value) && value.length > 0);
    plansByUser[admin.id] = hasAnyPlans ? [] : await readLegacyPlans(config);
    changed = true;
  }

  for (const user of users) {
    plansByUser[user.id] = sanitizePlans(plansByUser[user.id]);
    snapshotsByUser[user.id] = sanitizeSnapshots(snapshotsByUser[user.id]);
    mapsByUser[user.id] = sanitizeMapWorkspace(mapsByUser[user.id]);
  }

  if (enforceSingleActiveUserPerEmail(users)) {
    changed = true;
  }

  withUserMaps({
    users,
    plansByUser,
    snapshotsByUser,
    mapsByUser,
  });

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
    await writeJson(config, config.messagesPath, messages, 'Initialize day messages');
    await writeJson(config, config.mapsPath, mapsByUser, 'Initialize day map workspace');
  }

  return {
    config,
    users,
    plansByUser,
    snapshotsByUser,
    messages,
    mapsByUser,
  };
};

export const saveUsers = async (config, users) => {
  const nextUsers = users.map(sanitizeUser);
  enforceSingleActiveUserPerEmail(nextUsers);
  await writeJson(config, config.usersPath, nextUsers, 'Update day users');
};

export const savePlansByUser = async (config, plansByUser) => {
  await writeJson(config, config.userPlansPath, plansByUser, 'Update day user plans');
};

export const saveSnapshotsByUser = async (config, snapshotsByUser) => {
  await writeJson(config, config.snapshotsPath, snapshotsByUser, 'Update day user snapshots');
};

export const saveMessages = async (config, messages) => {
  await writeJson(config, config.messagesPath, sanitizeMessages(messages), 'Update day messages');
};

export const saveMapsByUser = async (config, mapsByUser) => {
  await writeJson(config, config.mapsPath, mapsByUser, 'Update day map workspace');
};

export const findUsersByEmail = (users, email) => users.filter((user) => normalizeEmail(user.email) === normalizeEmail(email));

export const findActiveUserByEmail = (users, email) => (
  findUsersByEmail(users, email).find((user) => user.isActive !== false) || null
);

export const findUserById = (users, userId) => users.find((user) => user.id === userId);

export const createUserRecord = ({ email, username = '', password, role = 'user' }) => {
  const now = new Date().toISOString();
  return sanitizeUser({
    id: createUserId(),
    managementId: createManagementUserId({ email, username, createdAt: now }),
    email: normalizeEmail(email),
    username: (username || '').trim(),
    passwordHash: hashPassword(password),
    role,
    birthday: '',
    resetCodeHash: '',
    resetCodeExpiresAt: '',
    lastBirthdayGreetingYear: '',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
};

export const updateUserProfile = (user, updates = {}) => {
  const nextUser = sanitizeUser({ ...user, ...updates, updatedAt: new Date().toISOString() });
  return nextUser;
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

export const createMessageRecord = ({ userId, userEmail, username = '', content, emailStatus = 'pending', emailError = '' }) => sanitizeMessage({
  userId,
  userEmail,
  username,
  content,
  createdAt: new Date().toISOString(),
  emailStatus,
  emailError,
});

export const getMessages = (messages) => sanitizeMessages(messages).sort((left, right) => right.createdAt.localeCompare(left.createdAt));

export const getUserMapWorkspace = (mapsByUser, userId) => sanitizeMapWorkspace(mapsByUser[userId]);

export const setUserMapWorkspace = (mapsByUser, userId, workspace, options = {}) => {
  const currentWorkspace = getUserMapWorkspace(mapsByUser, userId);
  const expectedRevision = Number.isInteger(options.expectedRevision) ? options.expectedRevision : null;
  const force = options.force === true;

  if (expectedRevision !== null && !force && currentWorkspace.revision !== expectedRevision) {
    return {
      conflict: true,
      currentWorkspace,
      savedWorkspace: currentWorkspace,
    };
  }

  const incomingHasShare = Boolean(
    workspace
    && typeof workspace === 'object'
    && !Array.isArray(workspace)
    && Object.prototype.hasOwnProperty.call(workspace, 'share'),
  );
  const sanitizedWorkspace = sanitizeMapWorkspace(workspace);
  const nextWorkspace = sanitizeMapWorkspace({
    ...sanitizedWorkspace,
    share: incomingHasShare ? sanitizeMapShare(workspace.share) : currentWorkspace.share,
    revision: currentWorkspace.revision + 1,
    savedAt: new Date().toISOString(),
  });
  mapsByUser[userId] = nextWorkspace;

  return {
    conflict: false,
    currentWorkspace,
    savedWorkspace: nextWorkspace,
  };
};

export const getUserWorkspaceDataSizeBytes = ({
  plansByUser,
  mapsByUser,
  userId,
  nextPlans,
  nextMapWorkspace,
}) => {
  const normalizedPlans = nextPlans === undefined ? getUserPlans(plansByUser, userId) : sanitizePlans(nextPlans);
  const normalizedMapWorkspace = nextMapWorkspace === undefined
    ? getUserMapWorkspace(mapsByUser, userId)
    : sanitizeMapWorkspace(nextMapWorkspace);

  return estimateJsonBytes({
    plans: normalizedPlans,
    mapWorkspace: normalizedMapWorkspace,
  });
};

export const assertUserWorkspaceQuota = ({
  users,
  plansByUser,
  mapsByUser,
  userId,
  nextPlans,
  nextMapWorkspace,
  limitBytes = NORMAL_USER_STORAGE_LIMIT_BYTES,
}) => {
  const user = findUserById(users, userId);
  if (!user) {
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const totalBytes = getUserWorkspaceDataSizeBytes({
    plansByUser,
    mapsByUser,
    userId,
    nextPlans,
    nextMapWorkspace,
  });

  if (user.role === 'admin') {
    return {
      limited: false,
      totalBytes,
      limitBytes,
    };
  }

  if (totalBytes > limitBytes) {
    const error = new Error('User storage quota exceeded');
    error.code = 'USER_STORAGE_LIMIT_EXCEEDED';
    error.totalBytes = totalBytes;
    error.limitBytes = limitBytes;
    throw error;
  }

  return {
    limited: true,
    totalBytes,
    limitBytes,
  };
};

export const withDataStoreLock = async (callback) => {
  const previousTask = dataStoreMutationQueue;
  let releaseCurrentTask = () => {};
  dataStoreMutationQueue = new Promise((resolve) => {
    releaseCurrentTask = resolve;
  });

  await previousTask.catch(() => {});

  try {
    return await callback();
  } finally {
    releaseCurrentTask();
  }
};

export const enforceSingleActiveUserPerEmail = (users) => {
  const byEmail = new Map();
  let changed = false;

  for (const user of users) {
    const email = normalizeEmail(user.email);
    if (!email) {
      continue;
    }
    if (!byEmail.has(email)) {
      byEmail.set(email, []);
    }
    byEmail.get(email).push(user);
  }

  for (const groupedUsers of byEmail.values()) {
    const activeUsers = groupedUsers.filter((user) => user.isActive !== false);
    if (activeUsers.length <= 1) {
      continue;
    }

    activeUsers.sort((left, right) => {
      const leftStamp = new Date(left.updatedAt || left.createdAt || 0).getTime();
      const rightStamp = new Date(right.updatedAt || right.createdAt || 0).getTime();
      return rightStamp - leftStamp;
    });

    const [keeper, ...duplicates] = activeUsers;
    keeper.isActive = true;

    for (const duplicate of duplicates) {
      if (duplicate.isActive !== false) {
        duplicate.isActive = false;
        duplicate.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
  }

  return changed;
};
