const API_VERSION = '2022-11-28';

const sendJson = (res, statusCode, payload) => {
  res.status(statusCode).json(payload);
};

const getConfig = () => {
  const requiredEnv = {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
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

const buildContentsUrl = ({ owner, repo, plansPath, branch }) => {
  const encodedPath = plansPath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
};

const githubRequest = async (url, token) => {
  return fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION,
    },
  });
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { status: 'error', message: 'Method not allowed' });
  }

  try {
    const config = getConfig();
    const response = await githubRequest(buildContentsUrl(config), config.token);

    if (response.status === 404) {
      return sendJson(res, 200, {
        status: 'success',
        source: 'github',
        data: [],
        sha: null,
        path: config.plansPath,
      });
    }

    if (!response.ok) {
      const details = await response.text();
      return sendJson(res, response.status, {
        status: 'error',
        message: 'Failed to load plans from GitHub',
        details,
      });
    }

    const payload = await response.json();
    const rawContent = Buffer.from(payload.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    const data = JSON.parse(rawContent);

    if (!Array.isArray(data)) {
      return sendJson(res, 500, {
        status: 'error',
        message: 'GitHub plans file must contain a JSON array',
      });
    }

    return sendJson(res, 200, {
      status: 'success',
      source: 'github',
      data,
      sha: payload.sha,
      path: config.plansPath,
    });
  } catch (error) {
    return sendJson(res, 500, {
      status: 'error',
      message: error.message || 'Unexpected error while loading plans',
    });
  }
}
