#!/usr/bin/env node

/**
 * Daily Backup Script
 * Fetches the latest multi-user data store files from GitHub and saves them
 * into a dated backup folder with a manifest.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_RATE_LIMIT_MAX_RETRIES = 2;
const DEFAULT_RATE_LIMIT_RETRY_CAP_MS = 30_000;
const RATE_LIMIT_MAX_RETRIES = Math.max(
  0,
  Number.parseInt(process.env.GITHUB_RATE_LIMIT_MAX_RETRIES || `${DEFAULT_RATE_LIMIT_MAX_RETRIES}`, 10)
    || DEFAULT_RATE_LIMIT_MAX_RETRIES,
);
const RATE_LIMIT_RETRY_CAP_MS = Math.max(
  1000,
  Number.parseInt(process.env.GITHUB_RATE_LIMIT_RETRY_CAP_MS || `${DEFAULT_RATE_LIMIT_RETRY_CAP_MS}`, 10)
    || DEFAULT_RATE_LIMIT_RETRY_CAP_MS,
);

const CORE_DATASETS = [
  {
    key: 'users',
    env: 'GITHUB_USERS_PATH',
    fallbackPath: 'data/users.json',
    fallbackValue: [],
    outputName: 'users.json',
    required: true,
  },
  {
    key: 'plansByUser',
    env: 'GITHUB_USER_PLANS_PATH',
    fallbackPath: 'data/plans-by-user.json',
    fallbackValue: {},
    outputName: 'plans-by-user.json',
    required: true,
  },
  {
    key: 'snapshotsByUser',
    env: 'GITHUB_SNAPSHOTS_PATH',
    fallbackPath: 'data/plan-snapshots.json',
    fallbackValue: {},
    outputName: 'plan-snapshots.json',
    required: true,
  },
  {
    key: 'messages',
    env: 'GITHUB_MESSAGES_PATH',
    fallbackPath: 'data/messages.json',
    fallbackValue: [],
    outputName: 'messages.json',
    required: true,
  },
  {
    key: 'legacyPlans',
    env: 'GITHUB_PLANS_PATH',
    fallbackPath: 'data/plans.json',
    fallbackValue: [],
    outputName: 'legacy-plans.json',
    required: false,
  },
];

const getConfig = () => {
  const requiredEnv = {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER || 'Jo-Nan',
    repo: process.env.GITHUB_REPO || 'day-data',
    branch: process.env.GITHUB_BRANCH || 'main',
  };

  const missing = Object.entries(requiredEnv)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    ...requiredEnv,
    datasets: CORE_DATASETS.map((dataset) => ({
      ...dataset,
      sourcePath: process.env[dataset.env] || dataset.fallbackPath,
    })),
  };
};

const buildContentsUrl = ({ owner, repo }, filePath) => {
  const encodedPath = filePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
};

const githubHeaders = (token) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'User-Agent': 'day-app-backup',
  'X-GitHub-Api-Version': '2022-11-28',
});

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
    return Math.min(RATE_LIMIT_RETRY_CAP_MS, retryAfterMs + 300);
  }

  const resetEpochSeconds = parseHeaderInt(response.headers, 'x-ratelimit-reset');
  if (resetEpochSeconds !== null) {
    const untilResetMs = (resetEpochSeconds * 1000) - Date.now() + 300;
    if (untilResetMs > 0) {
      return Math.min(RATE_LIMIT_RETRY_CAP_MS, untilResetMs);
    }
  }

  return Math.min(RATE_LIMIT_RETRY_CAP_MS, 1000 * (attempt + 1));
};

const fetchJsonFromGitHub = async ({
  url,
  token,
  branch,
  fallbackValue,
  required,
  datasetKey,
  sourcePath,
}) => {
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt += 1) {
    const response = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
      headers: githubHeaders(token),
    });

    if (response.status === 404 && !required) {
      return {
        data: fallbackValue,
        exists: false,
      };
    }

    if (!response.ok) {
      const text = await response.text();
      const shouldRetry = attempt < RATE_LIMIT_MAX_RETRIES && isRateLimitResponse(response, text);
      if (shouldRetry) {
        await delay(getRetryDelayMs(response, attempt));
        continue;
      }
      throw new Error(
        `Failed to fetch dataset "${datasetKey}" (${sourcePath}): `
        + `${response.status} - ${text}`,
      );
    }

    const payload = await response.json();
    
    if (!payload.content) {
      throw new Error(`No content field in GitHub response for dataset "${datasetKey}" (${sourcePath})`);
    }

    // Decode base64 content
    const decodedContent = Buffer.from(payload.content, 'base64').toString('utf-8');
    try {
      return {
        data: JSON.parse(decodedContent),
        exists: true,
      };
    } catch (jsonError) {
      throw new Error(
        `Invalid JSON in dataset "${datasetKey}" (${sourcePath}): ${jsonError.message}`,
      );
    }
  }

  throw new Error(`Failed to fetch dataset "${datasetKey}" (${sourcePath}): retries exhausted`);
};

const getBackupDateStamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const countEntries = (data) => {
  if (Array.isArray(data)) {
    return data.length;
  }
  if (data && typeof data === 'object') {
    return Object.keys(data).length;
  }
  return 0;
};

const saveBackupBundle = ({ dateStamp, files, manifest }) => {
  const backupDir = path.join(__dirname, 'backups', 'multi-user', dateStamp);
  ensureDir(backupDir);

  for (const file of files) {
    const targetPath = path.join(backupDir, file.outputName);
    fs.writeFileSync(targetPath, `${JSON.stringify(file.data, null, 2)}\n`, 'utf-8');
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

  return backupDir;
};

const main = async () => {
  try {
    console.log('[Backup] Starting multi-user daily backup process...');
    
    const config = getConfig();
    const dateStamp = getBackupDateStamp();
    const createdAt = new Date().toISOString();
    const files = [];

    for (const dataset of config.datasets) {
      const url = buildContentsUrl(config, dataset.sourcePath);
      console.log(`[Backup] Fetching ${dataset.key} from GitHub (${dataset.sourcePath})...`);
      const result = await fetchJsonFromGitHub({
        url,
        token: config.token,
        branch: config.branch,
        fallbackValue: dataset.fallbackValue,
        required: dataset.required,
        datasetKey: dataset.key,
        sourcePath: dataset.sourcePath,
      });

      files.push({
        key: dataset.key,
        outputName: dataset.outputName,
        sourcePath: dataset.sourcePath,
        exists: result.exists,
        data: result.data,
      });
    }

    const manifest = {
      backupVersion: 2,
      datasetType: 'multi-user',
      createdAt,
      dateStamp,
      source: {
        owner: config.owner,
        repo: config.repo,
        branch: config.branch,
      },
      files: files.map((file) => ({
        key: file.key,
        outputName: file.outputName,
        sourcePath: file.sourcePath,
        exists: file.exists,
        entryCount: countEntries(file.data),
      })),
    };

    const backupPath = saveBackupBundle({ dateStamp, files, manifest });
    console.log(`[Backup] ✅ Successfully saved backup bundle: ${backupPath}`);

    for (const file of manifest.files) {
      console.log(`[Backup] ${file.outputName}: ${file.entryCount} entries${file.exists ? '' : ' (fallback created)'}`);
    }
    
  } catch (error) {
    console.error('[Backup] ❌ Error during backup:', error.message);
    process.exit(1);
  }
};

main();
