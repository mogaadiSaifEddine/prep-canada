import crypto from 'node:crypto';

export type Vars = Record<string, string | number | null | undefined>;

export class HttpError extends Error {
  status: number;
  code: string;
  extra?: Record<string, unknown>;
  constructor(status: number, code: string, message?: string, extra?: Record<string, unknown>) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
export const err = (status: number, code: string, message?: string, extra?: Record<string, unknown>) => new HttpError(status, code, message, extra);
// Error whose message has values in it: the client translates `key` with `vars` (see lib/i18n).
export const errT = (status: number, code: string, key: string, vars: Vars = {}) =>
  new HttpError(status, code, key.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m)), { key, vars });

export const uid = (n = 12) => crypto.randomBytes(n).toString('base64url');
export const sha256 = (s: unknown) => crypto.createHash('sha256').update(String(s)).digest('hex');
export const today = () => new Date().toISOString().slice(0, 10);

export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return 'scrypt$' + salt.toString('base64') + '$' + key.toString('base64');
}
export function checkPassword(pw: string, stored: unknown) {
  try {
    const [alg, s, k] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const key = crypto.scryptSync(pw, Buffer.from(s, 'base64'), 64, { N: 16384, r: 8, p: 1 });
    const want = Buffer.from(k, 'base64');
    return want.length === key.length && crypto.timingSafeEqual(want, key);
  } catch { return false; }
}

export function parseCookies(header: string | null | undefined) {
  const out: Record<string, string> = {};
  String(header || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export const clampStr = (s: unknown, n: number) => String(s ?? '').slice(0, n);
export const words = (s: unknown) => (String(s || '').trim().match(/\S+/g) || []).length;
export const toArr = <T = any>(a: T | T[] | null | undefined | ''): T[] => (Array.isArray(a) ? a : a == null || a === '' ? [] : [a]);

// Public base URL of the app, for links in emails and payment return URLs.
export function baseUrl(req: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = (req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '') || 'http').split(',')[0];
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host;
  return proto + '://' + host;
}
