import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
export const err = (status, code, message, extra) => new HttpError(status, code, message, extra);
// Error whose message has values in it: the client translates `key` with `vars` (see public/js/i18n.js).
export const errT = (status, code, key, vars = {}) => new HttpError(status, code, key.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)), { key, vars });

export const uid = (n = 12) => crypto.randomBytes(n).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
export const today = () => new Date().toISOString().slice(0, 10);

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return 'scrypt$' + salt.toString('base64') + '$' + key.toString('base64');
}
export function checkPassword(pw, stored) {
  try {
    const [alg, s, k] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const key = crypto.scryptSync(pw, Buffer.from(s, 'base64'), 64, { N: 16384, r: 8, p: 1 });
    const want = Buffer.from(k, 'base64');
    return want.length === key.length && crypto.timingSafeEqual(want, key);
  } catch { return false; }
}

export function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export const clampStr = (s, n) => String(s ?? '').slice(0, n);
export const words = (s) => (String(s || '').trim().match(/\S+/g) || []).length;
export const toArr = (a) => (Array.isArray(a) ? a : a == null || a === '' ? [] : [a]);

export function baseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return proto + '://' + req.headers.host;
}
