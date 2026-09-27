// Latest invitation rounds with the lowest score invited, per path.
// Express Entry refreshes itself from IRCC's public JSON feed (cached in the settings table).
// Québec and provincial rounds are bundled here and can be edited by an admin without a redeploy.
import { q, one } from './db';
import { err } from './util';
import type { Draws, EERound, PoolDist } from '../shared/types';

const IRCC_FEED = 'https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json';
const REFRESH_MS = 6 * 3600 * 1000;       // look for new rounds every 6 hours
const RETRY_MS = 30 * 60 * 1000;          // after a failed fetch, wait 30 minutes

export const EE_CATS: Record<string, string> = {
  french: 'French-language proficiency',
  cec: 'Canadian Experience Class',
  pnp: 'Provincial Nominee Program',
  health: 'Healthcare and social services',
  trades: 'Trades',
  transport: 'Transport',
  stem: 'STEM',
  education: 'Education',
  agri: 'Agriculture and agri-food',
  physicians: 'Physicians with Canadian experience',
  senior: 'Senior managers with Canadian experience',
  military: 'Skilled military recruits',
  fsw: 'Federal Skilled Worker',
  general: 'General (all programs)',
  other: 'Other'
};
export function eeCategory(name: unknown) {
  const s = String(name || '');
  if (/french/i.test(s)) return 'french';
  if (/canadian experience class/i.test(s)) return 'cec';
  if (/provincial nominee/i.test(s)) return 'pnp';
  if (/health/i.test(s)) return 'health';
  if (/trade/i.test(s)) return 'trades';
  if (/transport/i.test(s)) return 'transport';
  if (/stem|science|technology/i.test(s)) return 'stem';
  if (/education/i.test(s)) return 'education';
  if (/agri/i.test(s)) return 'agri';
  if (/physician/i.test(s)) return 'physicians';
  if (/senior manager/i.test(s)) return 'senior';
  if (/military/i.test(s)) return 'military';
  if (/federal skilled worker/i.test(s)) return 'fsw';
  if (/no program specified|general/i.test(s)) return 'general';
  return 'other';
}

// IRCC's pool distribution buckets (dd1…dd18 in the feed)
const DIST_KEYS: [string, number, number][] = [['dd1', 601, 1200], ['dd2', 501, 600], ['dd4', 491, 500], ['dd5', 481, 490], ['dd6', 471, 480], ['dd7', 461, 470], ['dd8', 451, 460], ['dd10', 441, 450], ['dd11', 431, 440], ['dd12', 421, 430], ['dd13', 411, 420], ['dd14', 401, 410], ['dd15', 351, 400], ['dd16', 301, 350], ['dd17', 0, 300]];

/* ---------- bundled data, checked 27 September 2026 ---------- */
// [round, date, category, invitations, lowest CRS]
const EE_2026: [number, string, string, number, number][] = [
  [444, '2026-09-16', 'senior', 250, 389], [443, '2026-09-15', 'cec', 2000, 519], [442, '2026-09-14', 'pnp', 576, 734],
  [441, '2026-09-04', 'health', 3500, 475], [440, '2026-09-03', 'physicians', 229, 198], [439, '2026-09-01', 'cec', 2000, 521],
  [438, '2026-08-31', 'pnp', 562, 697], [437, '2026-08-19', 'french', 5000, 382], [436, '2026-08-18', 'cec', 1000, 523],
  [435, '2026-08-17', 'pnp', 442, 760], [434, '2026-08-07', 'transport', 300, 470], [433, '2026-08-06', 'french', 5000, 391],
  [432, '2026-08-05', 'cec', 3000, 516], [431, '2026-08-04', 'pnp', 507, 768], [430, '2026-07-23', 'military', 4, 368],
  [429, '2026-07-22', 'french', 5000, 399], [428, '2026-07-21', 'cec', 2000, 516], [427, '2026-07-20', 'pnp', 511, 744],
  [426, '2026-07-10', 'senior', 500, 392], [425, '2026-07-09', 'french', 5000, 420], [424, '2026-07-07', 'cec', 2000, 517],
  [423, '2026-07-06', 'pnp', 534, 708], [422, '2026-06-25', 'health', 4000, 475], [421, '2026-06-24', 'physicians', 271, 223],
  [420, '2026-06-23', 'cec', 4000, 516], [419, '2026-06-22', 'pnp', 955, 730], [418, '2026-05-28', 'french', 4500, 409],
  [417, '2026-05-27', 'cec', 3000, 518], [416, '2026-05-25', 'pnp', 334, 805], [415, '2026-05-11', 'pnp', 380, 798],
  [414, '2026-04-29', 'french', 4000, 400], [413, '2026-04-28', 'cec', 2000, 514], [412, '2026-04-27', 'pnp', 473, 795],
  [411, '2026-04-15', 'french', 4000, 419], [410, '2026-04-14', 'cec', 2000, 515], [409, '2026-04-13', 'pnp', 324, 786],
  [408, '2026-04-02', 'trades', 3000, 477], [407, '2026-03-31', 'cec', 2250, 509], [406, '2026-03-30', 'pnp', 356, 802],
  [405, '2026-03-18', 'french', 4000, 393], [404, '2026-03-17', 'cec', 4000, 507], [403, '2026-03-16', 'pnp', 362, 742],
  [402, '2026-03-05', 'senior', 250, 429], [401, '2026-03-04', 'french', 5500, 397], [400, '2026-03-03', 'cec', 4000, 508],
  [399, '2026-03-02', 'pnp', 264, 710], [398, '2026-02-20', 'health', 4000, 467], [397, '2026-02-19', 'physicians', 391, 169],
  [396, '2026-02-17', 'cec', 6000, 508], [395, '2026-02-16', 'pnp', 279, 789], [394, '2026-02-06', 'french', 8500, 400],
  [393, '2026-02-03', 'pnp', 423, 749], [392, '2026-01-21', 'cec', 6000, 509]
];
const EE_DIST: PoolDist = { asOf: '2026-09-13', total: 226793, buckets: [[601, 1200, 574], [501, 600, 20784], [491, 500, 12590], [481, 490, 12426], [471, 480, 16105], [461, 470, 16163], [451, 460, 14823], [441, 450, 13657], [431, 440, 13300], [421, 430, 12064], [411, 420, 11506], [401, 410, 11033], [351, 400, 46782], [301, 350, 17240], [0, 300, 7746]] };

export const BUNDLED: Omit<Draws, 'live' | 'updated'> = {
  checked: '2026-09-27',
  ee: {
    source: 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds.html',
    rounds: EE_2026.map(([n, date, cat, itas, crs]) => ({ n, date, cat, name: EE_CATS[cat], itas, crs })),
    dist: EE_DIST,
    note: 'No general (all-program) draw since April 2024: invitations go to categories, CEC and provincial nominees.'
  },
  quebec: {
    source: 'https://www.quebec.ca/en/immigration/permanent/skilled-workers/skilled-worker-selection-program/invitation/2026',
    note: 'Arrima scores are on Québec\'s own scale (out of about 1,350), not CRS. Recent rounds mostly target people already in Québec and priority sectors.',
    rounds: [
      { date: '2026-09-24', stream: 1, itas: 86, groups: [['Science, health and social services', 37, 634], ['Food service', 8, 706], ['Engineering, trades and tech', 41, 696]] },
      { date: '2026-09-24', stream: 2, itas: 121, groups: [['Priority sectors', 54, 581], ['Other', 67, 631]] },
      { date: '2026-08-27', stream: 1, itas: 87, groups: [['Science, health and social services', 26, 639], ['Food service', 11, 710], ['Engineering, trades and tech', 50, 694]] },
      { date: '2026-08-27', stream: 2, itas: 111, groups: [['Priority sectors', 52, 570], ['Other', 59, 635]] },
      { date: '2026-07-30', stream: 1, itas: 105, groups: [['Science, health and social services', 44, 651], ['Food service', 12, 702], ['Engineering and trades', 49, 701]] },
      { date: '2026-07-30', stream: 2, itas: 128, groups: [['Priority sectors', 61, 569], ['Other', 67, 629]] },
      { date: '2026-07-03', stream: 1, itas: 74, groups: [['Healthcare and social services', 31, 628], ['Food and construction', 5, 726], ['Engineering and trades', 38, 656]] },
      { date: '2026-07-03', stream: 2, itas: 124, groups: [['Priority sectors', 45, 600], ['Other', 79, 645]] },
      { date: '2026-06-04', stream: 1, itas: 1094, groups: [['General', 459, 677], ['Priority sectors', 165, 666], ['Other', 231, 692]] },
      { date: '2026-06-04', stream: 2, itas: 575, groups: [['General', 155, 661], ['Other', 244, 638]] }
    ]
  },
  provinces: {
    note: 'Provincial scores use each province\'s own grid and are not comparable with CRS. Many provinces do not publish a minimum.',
    rounds: [
      { date: '2026-08-13', prov: 'MB', stream: 'Skilled Worker (draw 277)', itas: 53, min: null },
      { date: '2026-08-12', prov: 'AB', stream: 'Dedicated Health Care Pathway', itas: 57, min: 60 },
      { date: '2026-08-06', prov: 'BC', stream: 'Skills Immigration: construction trades', itas: 187, min: 88 },
      { date: '2026-07-22', prov: 'NB', stream: 'Atlantic Immigration Program', itas: 114, min: null },
      { date: '2026-07-16', prov: 'NB', stream: 'Strategic Initiative: francophone workers and priorities', itas: 254, min: null, fr: true },
      { date: '2026-07-16', prov: 'NB', stream: 'NB Express Entry: employment in NB', itas: 115, min: null },
      { date: '2026-07-16', prov: 'MB', stream: 'Draw 275, including a francophone group', itas: 84, min: null, fr: true }
    ],
    news: [
      'Ontario closed all former OINP streams on 30 May 2026, including the French-Speaking Skilled Worker stream. The new Ontario Workforce Priority stream opened on 4 August 2026 and had not drawn yet in September.',
      'New Brunswick\'s Strategic Initiative asks for NCLC 5 in all four French skills and a job or connection in the province.'
    ]
  }
};

/* ---------- storage ---------- */
async function getSetting(key: string) { const r = await one('select data, updated_at from settings where key=$1', [key]); return r ? { data: r.data, at: new Date(r.updated_at).getTime() } : null; }
async function putSetting(key: string, data: unknown) {
  await q(`insert into settings(key, data, updated_at) values($1,$2,now()) on conflict(key) do update set data=excluded.data, updated_at=now()`, [key, JSON.stringify(data)]);
}

type Live = { rounds: EERound[]; dist: PoolDist | null; fetchedAt?: string };
export function parseFeed(json: any): Live {
  const rows: any[] = (json && json.rounds) || [];
  const num = (s: unknown) => Number(String(s ?? '').replace(/[^0-9.]/g, '')) || 0;
  const rounds = rows.map((r) => ({ n: num(r.drawNumber), date: String(r.drawDate || '').slice(0, 10), cat: eeCategory(r.drawName), name: String(r.drawName || '').replace(/,?\s*\d{4}-Version \d+$/i, ''), itas: num(r.drawSize), crs: num(r.drawCRS) }))
    .filter((r) => r.n && /^\d{4}-\d\d-\d\d$/.test(r.date) && r.crs)
    .sort((a, b) => b.n - a.n);
  let dist: PoolDist | null = null;
  const top = rows.find((r) => r.dd18);
  if (top) {
    const asOf = new Date(top.drawDistributionAsOn + ' UTC');
    dist = { asOf: isNaN(asOf.getTime()) ? null : asOf.toISOString().slice(0, 10), total: num(top.dd18), buckets: DIST_KEYS.map(([k, lo, hi]) => [lo, hi, num(top[k])]) };
  }
  return { rounds, dist };
}

let inflight: Promise<Live> | null = null;
async function refreshEE(force?: boolean): Promise<Live | null> {
  if (process.env.DRAWS_OFFLINE === '1' || process.env.GEMINI_MOCK === '1') return null;
  const cached = await getSetting('draws_ee').catch(() => null);
  const last = await getSetting('draws_ee_try').catch(() => null);
  const fresh = cached && Date.now() - cached.at < REFRESH_MS;
  const tooSoon = last && Date.now() - last.at < RETRY_MS;
  if (!force && (fresh || tooSoon)) return cached ? (cached.data as Live) : null;
  if (!inflight) {
    inflight = (async () => {
      await putSetting('draws_ee_try', { at: Date.now() }).catch(() => {});
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
      try {
        const r = await fetch(IRCC_FEED, { signal: ctl.signal, headers: { accept: 'application/json' } });
        if (!r.ok) throw new Error('IRCC feed ' + r.status);
        const parsed = parseFeed(await r.json());
        if (parsed.rounds.length < 10) throw new Error('IRCC feed looked empty');
        const data: Live = { ...parsed, rounds: parsed.rounds.slice(0, 120), fetchedAt: new Date().toISOString() };
        await putSetting('draws_ee', data);
        return data;
      } finally { clearTimeout(t); inflight = null; }
    })();
  }
  try { return await inflight; } catch (e) { console.warn('[draws]', (e as Error).message); return cached ? (cached.data as Live) : null; }
}

// What the app shows: bundled data, overridden by admin edits, with Express Entry from IRCC when available.
export async function currentDraws({ force = false } = {}): Promise<Draws> {
  const over = await getSetting('draws_manual').catch(() => null);
  const base = over ? { ...BUNDLED, ...over.data } : BUNDLED;
  const merge = (a: EERound[], b: EERound[] | undefined) => { const m = new Map(a.map((r) => [r.n, r])); for (const r of b || []) m.set(r.n, r); return [...m.values()].sort((x, y) => y.n - x.n); };
  const out: Draws = { ...base, ee: { ...BUNDLED.ee, rounds: merge(BUNDLED.ee.rounds, over && over.data.ee && over.data.ee.rounds) }, live: false };
  const live = await refreshEE(force).catch(() => null);
  if (live && live.rounds && live.rounds.length) {
    // Keep any bundled round the feed has not published yet, then newest first
    const byN = new Map(out.ee.rounds.map((r) => [r.n, r]));
    for (const r of live.rounds) byN.set(r.n, r);
    out.ee = { ...out.ee, rounds: [...byN.values()].sort((a, b) => b.n - a.n).slice(0, 120), dist: live.dist || out.ee.dist, fetchedAt: live.fetchedAt };
    out.live = true;
  }
  out.updated = [out.checked, out.ee.rounds[0] && out.ee.rounds[0].date].filter(Boolean).sort().pop();
  return out;
}

// Admin: replace the Québec / provinces blocks (and optionally extra EE rounds) without a redeploy.
export async function saveManual(data: any) {
  if (!data || typeof data !== 'object') throw err(400, 'bad_request', 'Send a JSON object.');
  const allowed: Record<string, any> = {};
  if (data.checked) allowed.checked = String(data.checked).slice(0, 10);
  for (const k of ['quebec', 'provinces']) {
    if (data[k] != null) {
      if (!Array.isArray(data[k].rounds)) throw err(400, 'bad_request', k + '.rounds must be a list.');
      allowed[k] = data[k];
    }
  }
  if (data.ee && Array.isArray(data.ee.rounds)) {
    allowed.ee = { rounds: data.ee.rounds.map((r: any) => ({ n: Number(r.n), date: String(r.date).slice(0, 10), cat: r.cat || eeCategory(r.name), name: r.name || EE_CATS[r.cat] || '', itas: Number(r.itas), crs: Number(r.crs) })).filter((r: EERound) => r.n && r.crs) };
  }
  if (JSON.stringify(allowed).length > 200_000) throw err(413, 'too_large', 'Too large.');
  await putSetting('draws_manual', allowed);
  return allowed;
}
export async function clearManual() { await q(`delete from settings where key='draws_manual'`); }
