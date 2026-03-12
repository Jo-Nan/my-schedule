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
  'X-GitHub-Api-Version': API_VERSION,
});

const parseRequestBody = async (req) => {
  if (Array.isArray(req.body)) {
    return req.body;
  }

  if (typeof req.body === 'string' && req.body.length > 0) {
    return JSON.parse(req.body);
  }

  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf-8');
  return rawBody ? JSON.parse(rawBody) : null;
};

const fetchExistingSha = async (url, token, branch) => {
  const response = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
    headers: githubHeaders(token),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to fetch current GitHub file: ${details}`);
  }

  const payload = await response.json();
  return payload.sha;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { status: 'error', message: 'Method not allowed' });
  }

  try {
    const config = getConfig();
    const plans = await parseRequestBody(req);

    if (!Array.isArray(plans)) {
      return sendJson(res, 400, {
        status: 'error',
        message: 'Request body must be a JSON array of plans',
      });
    }

    const url = buildContentsUrl(config);
    const sha = await fetchExistingSha(url, config.token, config.branch);
    const content = Buffer.from(`${JSON.stringify(plans, null, 2)}\n`, 'utf-8').toString('base64');
    const payload = {
      message: `Update plans via day app (${new Date().toISOString()})`,
      content,
      branch: config.branch,
    };

    if (sha) {
      payload.sha = sha;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...githubHeaders(config.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await response.text();
      return sendJson(res, response.status, {
        status: 'error',
        message: 'Failed to save plans to GitHub',
        details,
      });
    }

    const result = await response.json();

    return sendJson(res, 200, {
      status: 'success',
      source: 'github',
      path: config.plansPath,
      commitSha: result.commit?.sha || null,
      fileSha: result.content?.sha || null,
    });
  } catch (error) {
    return sendJson(res, 500, {
      status: 'error',
      message: error.message || 'Unexpected error while saving plans',
    });
  }
}
