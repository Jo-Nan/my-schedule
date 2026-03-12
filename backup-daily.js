#!/usr/bin/env node

/**
 * Daily Backup Script
 * Fetches the latest plans.json from GitHub and saves it with a dated filename
 * Filename format: YYYYMMDD.json (e.g., 20260313.json)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getConfig = () => {
  const requiredEnv = {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER || 'Jo-Nan',
    repo: process.env.GITHUB_REPO || 'day-data',
    branch: process.env.GITHUB_BRANCH || 'main',
    plansPath: process.env.GITHUB_PLANS_PATH || 'data/plans.json',
  };

  const missing = Object.entries(requiredEnv)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return requiredEnv;
};

const buildContentsUrl = ({ owner, repo, plansPath }) => {
  const encodedPath = plansPath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
};

const githubHeaders = (token) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

const fetchPlansFromGitHub = async (url, token, branch) => {
  const response = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
    headers: githubHeaders(token),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch from GitHub: ${response.status} - ${text}`);
  }

  const payload = await response.json();
  
  if (!payload.content) {
    throw new Error('No content field in GitHub response');
  }

  // Decode base64 content
  const decodedContent = Buffer.from(payload.content, 'base64').toString('utf-8');
  return JSON.parse(decodedContent);
};

const getBackupFilename = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}.json`;
};

const saveBackup = (plans, filename) => {
  const backupsDir = path.join(__dirname, 'backups');
  
  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const filepath = path.join(backupsDir, filename);
  const content = JSON.stringify(plans, null, 2) + '\n';
  
  fs.writeFileSync(filepath, content, 'utf-8');
  return filepath;
};

const main = async () => {
  try {
    console.log('[Backup] Starting daily backup process...');
    
    const config = getConfig();
    const url = buildContentsUrl(config);
    const filename = getBackupFilename();
    
    console.log(`[Backup] Fetching plans from GitHub...(${filename})`);
    const plans = await fetchPlansFromGitHub(url, config.token, config.branch);
    
    const backupPath = saveBackup(plans, filename);
    console.log(`[Backup] ✅ Successfully saved backup: ${backupPath}`);
    console.log(`[Backup] Total plans backed up: ${plans.length}`);
    
    // Log summary
    const completed = plans.filter(p => p.status === 'completed').length;
    console.log(`[Backup] Summary: ${completed}/${plans.length} completed`);
    
  } catch (error) {
    console.error('[Backup] ❌ Error during backup:', error.message);
    process.exit(1);
  }
};

main();
