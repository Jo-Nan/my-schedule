import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_VERSION = '2022-11-28';
const DEFAULT_GITHUB_READ_CACHE_TTL_MS = 15_000;
const DEFAULT_GITHUB_RATE_LIMIT_MAX_RETRIES = 2;
const DEFAULT_GITHUB_RATE_LIMIT_RETRY_CAP_MS = 30_000;
const GITHUB_READ_CACHE_TTL_MS = Math.max(
  0,
  Number.parseInt(process.env.GITHUB_READ_CACHE_TTL_MS || `${DEFAULT_GITHUB_READ_CACHE_TTL_MS}`, 10)
    || DEFAULT_GITHUB_READ_CACHE_TTL_MS,
);
const GITHUB_RATE_LIMIT_MAX_RETRIES = Math.max(
  0,
  Number.parseInt(process.env.GITHUB_RATE_LIMIT_MAX_RETRIES || `${DEFAULT_GITHUB_RATE_LIMIT_MAX_RETRIES}`, 10)
    || DEFAULT_GITHUB_RATE_LIMIT_MAX_RETRIES,
);
const GITHUB_RATE_LIMIT_RETRY_CAP_MS = Math.max(
  1000,
  Number.parseInt(process.env.GITHUB_RATE_LIMIT_RETRY_CAP_MS || `${DEFAULT_GITHUB_RATE_LIMIT_RETRY_CAP_MS}`, 10)
    || DEFAULT_GITHUB_RATE_LIMIT_RETRY_CAP_MS,
);
const githubReadCache = new Map();
const githubReadInFlight = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const LOCAL_DATA_DIR = path.join(PROJECT_ROOT, '.local-data');
let dataStoreMutationQueue = Promise.resolve();
export const NORMAL_USER_STORAGE_LIMIT_BYTES = 15 * 1024 * 1024;
const runtimeSecretCache = new Map();

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
  expiresAt: typeof share?.expiresAt === 'string' ? share.expiresAt.trim() : '',
});

export const isMapShareActive = (share = {}, now = Date.now()) => {
  const normalized = sanitizeMapShare(share);
  if (!normalized.enabled || !normalized.token || !normalized.expiresAt) {
    return false;
  }

  const expiresAt = Date.parse(normalized.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
};

const sanitizeMapRegionMeta = (meta = {}) => ({
  lookupStatus: meta?.lookupStatus === 'failed' ? 'failed' : (meta?.lookupStatus === 'resolved' ? 'resolved' : 'pending'),
  isChina: meta?.isChina === true,
  countryCode: typeof meta?.countryCode === 'string' ? meta.countryCode.trim().toUpperCase() : '',
  countryName: typeof meta?.countryName === 'string' ? meta.countryName.trim() : '',
  provinceName: typeof meta?.provinceName === 'string' ? meta.provinceName.trim() : '',
  cityName: typeof meta?.cityName === 'string' ? meta.cityName.trim() : '',
});

const sanitizeMapCollaborators = (collaborators) => (
  Array.isArray(collaborators)
    ? collaborators.map((item) => ({
      id: typeof item?.id === 'string' ? item.id : `collab_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      token: typeof item?.token === 'string' ? item.token.trim() : '',
      ownerId: typeof item?.ownerId === 'string' ? item.ownerId.trim() : '',
      ownerName: typeof item?.ownerName === 'string' ? item.ownerName.trim() : '',
      displayName: typeof item?.displayName === 'string' ? item.displayName.trim() : '',
      color: typeof item?.color === 'string' ? item.color.trim() : '',
      regionColor: typeof item?.regionColor === 'string' ? item.regionColor.trim() : '',
      hidden: item?.hidden === true,
      points: Array.isArray(item?.points)
        ? item.points
          .map((point) => {
            const latitude = Number.parseFloat(point?.latitude);
            const longitude = Number.parseFloat(point?.longitude);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
              return null;
            }
            return {
              id: typeof point?.id === 'string' ? point.id : `cp_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
              place: typeof point?.place === 'string' ? point.place : '',
              latitude: Math.max(-90, Math.min(90, latitude)),
              longitude: Math.max(-180, Math.min(180, longitude)),
              route: typeof point?.route === 'string' ? point.route : '',
              regionMeta: sanitizeMapRegionMeta(point?.regionMeta),
            };
          })
          .filter(Boolean)
        : [],
      importedAt: typeof item?.importedAt === 'string' ? item.importedAt : new Date().toISOString(),
    }))
    : []
);

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

const sanitizeMapDisplayMode = (value) => (value === 'merge' ? 'merge' : 'default');

const sanitizeMapMergePairUserIds = (value) => {
  const source = Array.isArray(value) ? value : [value];
  const unique = [];
  source.forEach((item) => {
    if (typeof item !== 'string') {
      return;
    }
    const trimmed = item.trim();
    if (!trimmed || unique.includes(trimmed)) {
      return;
    }
    unique.push(trimmed);
  });
  return unique.slice(0, 2);
};

const sanitizeMapWorkspace = (workspace = {}) => {
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) {
    return {
      scope: 'china',
      displayMode: 'default',
      mergePairUserIds: [],
      showFeaturedBubbles: true,
      showMarkerNames: true,
      bubbleLayout: 'freestyle',
      users: [],
      points: [],
      collaborators: [],
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
    displayMode: sanitizeMapDisplayMode(workspace.displayMode),
    mergePairUserIds: sanitizeMapMergePairUserIds(workspace.mergePairUserIds),
    showFeaturedBubbles: workspace.showFeaturedBubbles !== false,
    showMarkerNames: workspace.showMarkerNames !== false,
    bubbleLayout: ['map', 'right', 'bottom', 'freestyle'].includes(workspace.bubbleLayout) ? workspace.bubbleLayout : 'freestyle',
    users: Array.isArray(workspace.users) ? workspace.users : [],
    points: Array.isArray(workspace.points) ? workspace.points : [],
    collaborators: sanitizeMapCollaborators(workspace.collaborators),
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
      runtimeSecretsPath: process.env.GITHUB_RUNTIME_SECRETS_PATH || 'data/runtime-secrets.json',
    };
  }

  return {
    mode: 'local',
    usersPath: path.join(LOCAL_DATA_DIR, 'users.json'),
    userPlansPath: path.join(LOCAL_DATA_DIR, 'plans-by-user.json'),
    snapshotsPath: path.join(LOCAL_DATA_DIR, 'plan-snapshots.json'),
    messagesPath: path.join(LOCAL_DATA_DIR, 'messages.json'),
    mapsPath: path.join(LOCAL_DATA_DIR, 'map-by-user.json'),
    legacyPlansPath: path.join(LOCAL_DATA_DIR, 'legacy-plans.json'),
    runtimeSecretsPath: path.join(LOCAL_DATA_DIR, 'runtime-secrets.json'),
  };
};

const githubHeaders = (token) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'User-Agent': 'day-app-data-store',
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

const cloneJsonValue = (value) => structuredClone(value);

const parseHeaderInt = (headers, name) => {
  const raw = headers.get(name);
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseRetryAfterMs = (headers) => {
  const retryAfter = headers.get('retry-after');
  if (!retryAfter) {
    return null;
  }

  const seconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const retryAt = Date.parse(retryAfter);
  if (Number.isFinite(retryAt)) {
    return Math.max(0, retryAt - Date.now());
  }

  return null;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimitResponse = (response, details) => {
  if (response.status === 429) {
    return true;
  }
  if (response.status !== 403) {
    return false;
  }

  const remaining = parseHeaderInt(response.headers, 'x-ratelimit-remaining');
  if (remaining === 0) {
    return true;
  }

  return /rate limit|secondary rate limit|abuse detection/i.test(details);
};

const getRetryDelayMs = (response, attempt) => {
  const retryAfterMs = parseRetryAfterMs(response.headers);
  if (retryAfterMs !== null) {
    return Math.min(GITHUB_RATE_LIMIT_RETRY_CAP_MS, retryAfterMs + 300);
  }

  const resetEpochSeconds = parseHeaderInt(response.headers, 'x-ratelimit-reset');
  if (resetEpochSeconds !== null) {
    const untilResetMs = (resetEpochSeconds * 1000) - Date.now() + 300;
    if (untilResetMs > 0) {
      return Math.min(GITHUB_RATE_LIMIT_RETRY_CAP_MS, untilResetMs);
    }
  }

  return Math.min(GITHUB_RATE_LIMIT_RETRY_CAP_MS, 1000 * (attempt + 1));
};

const buildGithubReadCacheKey = (config, filePath) => (
  `${config.owner}/${config.repo}/${config.branch}/${filePath}`
);

const getGithubReadCache = (cacheKey) => {
  if (GITHUB_READ_CACHE_TTL_MS <= 0) {
    return null;
  }

  const entry = githubReadCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if ((Date.now() - entry.cachedAt) > GITHUB_READ_CACHE_TTL_MS) {
    githubReadCache.delete(cacheKey);
    return null;
  }

  return {
    data: cloneJsonValue(entry.data),
    sha: entry.sha,
    exists: entry.exists,
  };
};

const setGithubReadCache = (cacheKey, value) => {
  if (GITHUB_READ_CACHE_TTL_MS <= 0) {
    return;
  }

  githubReadCache.set(cacheKey, {
    data: cloneJsonValue(value.data),
    sha: value.sha ?? null,
    exists: value.exists !== false,
    cachedAt: Date.now(),
  });
};

const readGithubJson = async (config, filePath, fallbackValue, options = {}) => {
  const cacheKey = buildGithubReadCacheKey(config, filePath);
  const bypassCache = options.bypassCache === true;

  if (!bypassCache) {
    const cached = getGithubReadCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const fetchTask = async () => {
    const url = buildGithubContentsUrl(config, filePath);

    for (let attempt = 0; attempt <= GITHUB_RATE_LIMIT_MAX_RETRIES; attempt += 1) {
      const response = await fetch(url, {
        headers: githubHeaders(config.token),
      });

      if (response.status === 404) {
        const result = { data: fallbackValue, sha: null, exists: false };
        if (!bypassCache) {
          setGithubReadCache(cacheKey, result);
        }
        return result;
      }

      if (response.ok) {
        const payload = await response.json();
        const raw = Buffer.from((payload.content || '').replace(/\n/g, ''), 'base64').toString('utf-8');
        const result = {
          data: JSON.parse(raw || 'null') ?? fallbackValue,
          sha: payload.sha || null,
          exists: true,
        };
        if (!bypassCache) {
          setGithubReadCache(cacheKey, result);
        }
        return result;
      }

      const details = await response.text();
      const shouldRetry = attempt < GITHUB_RATE_LIMIT_MAX_RETRIES && isRateLimitResponse(response, details);
      if (shouldRetry) {
        await delay(getRetryDelayMs(response, attempt));
        continue;
      }

      throw new Error(`Failed to read ${filePath} from GitHub: ${details}`);
    }

    throw new Error(`Failed to read ${filePath} from GitHub: retries exhausted`);
  };

  if (bypassCache) {
    return fetchTask();
  }

  const inFlight = githubReadInFlight.get(cacheKey);
  if (inFlight) {
    const result = await inFlight;
    return {
      data: cloneJsonValue(result.data),
      sha: result.sha,
      exists: result.exists,
    };
  }

  const task = fetchTask();
  githubReadInFlight.set(cacheKey, task);

  try {
    const result = await task;
    return {
      data: cloneJsonValue(result.data),
      sha: result.sha,
      exists: result.exists,
    };
  } finally {
    if (githubReadInFlight.get(cacheKey) === task) {
      githubReadInFlight.delete(cacheKey);
    }
  }
};

const writeGithubJson = async (config, filePath, data, message) => {
  const cacheKey = buildGithubReadCacheKey(config, filePath);
  const current = await readGithubJson(config, filePath, null, { bypassCache: true });
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

  let nextSha = current.sha || null;
  try {
    const body = await response.json();
    if (body?.content?.sha) {
      nextSha = body.content.sha;
    }
  } catch {
    // Best-effort cache refresh only.
  }

  setGithubReadCache(cacheKey, {
    data,
    sha: nextSha,
    exists: true,
  });
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

const normalizeRuntimeSecretValue = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

export const getPersistentRuntimeSecret = async (secretName) => {
  const normalizedName = normalizeRuntimeSecretValue(secretName);
  if (!normalizedName) {
    throw new Error('Runtime secret name is required');
  }

  const cached = runtimeSecretCache.get(normalizedName);
  if (cached) {
    return cached;
  }

  const config = getStorageConfig();
  const result = await readJson(config, config.runtimeSecretsPath, {});
  const existingSecrets = result.data && typeof result.data === 'object' && !Array.isArray(result.data)
    ? result.data
    : {};
  const existingSecret = normalizeRuntimeSecretValue(existingSecrets[normalizedName]);

  if (existingSecret) {
    runtimeSecretCache.set(normalizedName, existingSecret);
    return existingSecret;
  }

  const generatedSecret = crypto.randomBytes(32).toString('base64url');
  const nextSecrets = {
    ...existingSecrets,
    [normalizedName]: generatedSecret,
  };

  try {
    await writeJson(config, config.runtimeSecretsPath, nextSecrets, `Initialize runtime secret: ${normalizedName}`);
    runtimeSecretCache.set(normalizedName, generatedSecret);
    return generatedSecret;
  } catch (error) {
    const retryResult = await readJson(config, config.runtimeSecretsPath, {});
    const retrySecrets = retryResult.data && typeof retryResult.data === 'object' && !Array.isArray(retryResult.data)
      ? retryResult.data
      : {};
    const retrySecret = normalizeRuntimeSecretValue(retrySecrets[normalizedName]);

    if (retrySecret) {
      runtimeSecretCache.set(normalizedName, retrySecret);
      return retrySecret;
    }

    throw error;
  }
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

  if (rawUsers.some((user) => !(typeof user?.managementId === 'string' && user.managementId.trim()))) {
    changed = true;
  }

  const primaryAdmin = users.find((user) => user.role === 'admin' && user.isActive !== false) || null;

  if (primaryAdmin && !Array.isArray(plansByUser[primaryAdmin.id])) {
    const hasAnyPlans = Object.values(plansByUser).some((value) => Array.isArray(value) && value.length > 0);
    plansByUser[primaryAdmin.id] = hasAnyPlans ? [] : await readLegacyPlans(config);
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

  if (primaryAdmin && !snapshotsByUser[primaryAdmin.id]?.length && plansByUser[primaryAdmin.id]?.length) {
    snapshotsByUser[primaryAdmin.id] = [
      sanitizeSnapshot({
        snapshotDate: getShanghaiDateString(),
        createdAt: new Date().toISOString(),
        source: 'migration',
        plans: plansByUser[primaryAdmin.id],
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
