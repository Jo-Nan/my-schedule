import crypto from 'node:crypto';
import { ensureDataStore, findUserById, publicUser } from './store.js';

const SESSION_COOKIE = 'nanmuz_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

const getSessionSecret = () => process.env.SESSION_SECRET || process.env.AUTH_SECRET || 'day-local-dev-secret';

const base64UrlEncode = (value) => Buffer.from(value, 'utf-8').toString('base64url');
const base64UrlDecode = (value) => Buffer.from(value, 'base64url').toString('utf-8');

const sign = (value) => crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url');

export const createSessionToken = (user) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
};

const parseCookies = (cookieHeader = '') => Object.fromEntries(
  cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const index = chunk.indexOf('=');
      return [chunk.slice(0, index), decodeURIComponent(chunk.slice(index + 1))];
    })
    .filter(([key]) => key)
);

const verifySessionToken = (token) => {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [encoded, signature] = token.split('.');
  const expectedSignature = sign(encoded);
  const receivedSignature = Buffer.from(signature, 'utf-8');
  const safeExpected = Buffer.from(expectedSignature, 'utf-8');

  if (receivedSignature.length !== safeExpected.length || !crypto.timingSafeEqual(receivedSignature, safeExpected)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encoded));
    const now = Math.floor(Date.now() / 1000);
    if (!payload.sub || payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export const setSessionCookie = (res, user) => {
  const token = createSessionToken(user);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  res.setHeader('Set-Cookie', parts.join('; '));
};

export const clearSessionCookie = (res) => {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  res.setHeader('Set-Cookie', parts.join('; '));
};

export const getAuthenticatedUser = async (req) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const session = verifySessionToken(cookies[SESSION_COOKIE]);

  if (!session) {
    return null;
  }

  const store = await ensureDataStore();
  const user = findUserById(store.users, session.sub);

  if (!user || user.isActive === false) {
    return null;
  }

  return { ...store, user, safeUser: publicUser(user) };
};

export const requireAuth = async (req, res) => {
  const result = await getAuthenticatedUser(req);
  if (!result) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
    return null;
  }
  return result;
};

export const parseJsonBody = async (req) => {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string' && req.body.length > 0) {
    return JSON.parse(req.body);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? JSON.parse(raw) : {};
};
