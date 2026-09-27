// Browser → /api calls. Every write carries the x-requested-with header the server checks.
import { tk, type Vars } from '../i18n';

export type ApiError = { status?: number; code: string; message: string; key?: string; vars?: Vars };

export const HEADERS = { 'content-type': 'application/json', 'x-requested-with': 'prep-canada' };

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, { method, credentials: 'same-origin', headers: HEADERS, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch { throw { code: 'offline', message: tk('You seem to be offline. Check your connection and try again.') } as ApiError; }
  let j: any = null; try { j = await r.json(); } catch { /* not JSON */ }
  if (!r.ok) throw Object.assign({ status: r.status }, (j && j.error) || { code: 'server_error', message: tk('Something went wrong. Try again.') }) as ApiError;
  return j as T;
}

export const getDoc = <T = any>(ns: string, key: string) => api<{ data: T | null }>('GET', '/api/docs/' + ns + '/' + key).then((r) => r.data);
export const putDoc = (ns: string, key: string, val: unknown) => api('PUT', '/api/docs/' + ns + '/' + key, { data: val });
