import crypto from 'node:crypto';

export const WORKER_BASE_URL =
  process.env.GALLERY_RESOLVER_URL ||
  process.env.WORKER_API_BASE_URL ||
  'https://tanhbooth-api.laihoanganh456.workers.dev';

export const ADMIN_API_SECRET =
  process.env.ADMIN_API_SECRET ||
  process.env.GALLERY_RESOLVER_SECRET ||
  'theanh2002';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  ADMIN_API_SECRET ||
  'theanh2002-lumibooth-secret';

export const SESSION_COOKIE_NAME = 'sb_admin_session';

const ALLOWED_ORIGINS = new Set([
  'https://pica.photobooth.event-vn.com',
  'https://tachtach.event-vn.com',
  'https://tanh.event-vn.com',
  'https://luxe-agency-vn.vercel.app',
  'http://localhost:4200',
  'http://127.0.0.1:4200'
]);

export function setCors(req, res) {
  const origin = req.headers?.origin;
  if (origin && (ALLOWED_ORIGINS.has(origin) || process.env.NODE_ENV !== 'production')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

export function parseCookies(cookieHeader = '') {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=');
    if (!name) continue;
    cookies[decodeURIComponent(name)] = decodeURIComponent(rest.join('='));
  }
  return cookies;
}

export function signSession(payload) {
  const bodyBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(bodyBase64)
    .digest('base64url');
  return `${bodyBase64}.${signature}`;
}

export function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [bodyBase64, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(bodyBase64)
    .digest('base64url');

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(bodyBase64, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers?.cookie || '');
  const token = cookies[SESSION_COOKIE_NAME];
  return verifySession(token);
}

export function createSessionCookie(payload, isSecure = false) {
  const token = signSession(payload);
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isSecure ? '; Secure' : ''}`;
}

export function clearSessionCookie(isSecure = false) {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecure ? '; Secure' : ''}`;
}

export async function callWorkerApi(path, options = {}) {
  const url = `${WORKER_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const headers = new Headers(options.headers || {});

  if (options.asAdmin && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${ADMIN_API_SECRET}`);
  }

  const fetchOptions = {
    method: options.method || 'GET',
    headers,
    signal: options.signal
  };

  if (options.body) {
    if (typeof options.body === 'object' && !(options.body instanceof Uint8Array) && !(options.body instanceof ArrayBuffer)) {
      headers.set('Content-Type', 'application/json');
      fetchOptions.body = JSON.stringify(options.body);
    } else {
      fetchOptions.body = options.body;
    }
  }

  const response = await fetch(url, fetchOptions);
  return response;
}
