// Score helpers for the calculator, the invitation rounds and the per-path estimates.
// Pure functions (no DOM). The React views are in components/paths.
import { hue } from './palette';
import { crs, fsw, boosts, type CrsProfile, type CrsInput, type Levels } from './crs';
import type { Draws, EERound } from './types';
import type { Path } from '../paths/types';
import { t, tk, fmtDay } from '../i18n';

export const SK = ['L', 'R', 'W', 'S'] as const;
export const SKN = { L: tk('Listening'), R: tk('Reading'), W: tk('Writing'), S: tk('Speaking') };
export const PSKN = { L: tk('Partner listening'), R: tk('Partner reading'), W: tk('Partner writing'), S: tk('Partner speaking') };
export const SHORT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

export const CAT_LABEL: Record<string, string> = {
  french: tk('French-language'), cec: tk('Canadian Experience Class'), pnp: tk('Provincial nominees'), health: tk('Healthcare & social services'), trades: tk('Trades'), transport: tk('Transport'), stem: tk('STEM'), education: tk('Education'), agri: tk('Agriculture'), physicians: tk('Physicians (Cdn exp.)'), senior: tk('Senior managers (Cdn exp.)'), military: tk('Military recruits'), fsw: tk('Federal Skilled Worker'), general: tk('General'), other: tk('Other')
};
const CAT_HEX: Record<string, string> = { french: '#1F4FA8', cec: '#1D7650', pnp: '#8A5A00', health: '#9D174D', trades: '#B45309', transport: '#155E75', stem: '#6A4BC4', education: '#4D7C0F', agri: '#65731B', physicians: '#9D174D', senior: '#475569', military: '#475569', fsw: '#B4263A', general: '#B4263A', other: '#475569' };
export const CAT_COLOR: Record<string, string> = Object.fromEntries(Object.entries(CAT_HEX).map(([k, c]) => [k, hue(c)]));
// Occupation categories a candidate can pick (all others need Canadian experience)
export const OCC: [string, string][] = [['', tk('None of these / not sure')], ['health', tk('Healthcare & social services')], ['trades', tk('Trades')], ['transport', tk('Transport')], ['stem', tk('STEM')], ['education', tk('Education')], ['agri', tk('Agriculture & agri-food')]];

/** Language levels taken from the learner's latest IELTS / TEF results in the app. */
export type AppLevels = { en: number | null; fr: number | null; enDetail: Levels | null; frDetail: Levels | null };

/* ---------- profile ---------- */
export function defaultProfile(levels?: AppLevels | null): CrsProfile {
  const p: CrsProfile = { age: 30, spouse: 'single', edu: 'mast', caEdu: '0', en: { L: 0, R: 0, W: 0, S: 0 }, fr: { L: 0, R: 0, W: 0, S: 0 }, fwExp: 3, caExp: 0, cert: false, pnp: false, sibling: false, offer: false, relative: false, spStudyCa: false, occ: '', kids: 0, sp: { edu: 'bach', lang: { L: 0, R: 0, W: 0, S: 0 }, caExp: 0 } };
  return fillFromTests(p, levels);
}
export function fillFromTests(p: CrsProfile, levels?: AppLevels | null): CrsProfile {
  if (!levels) return p;
  if (levels.enDetail) p.en = { ...levels.enDetail };
  if (levels.frDetail) p.fr = { ...levels.frDetail };
  return p;
}
/** Saved profiles may come from an older version: fill in anything missing. */
export function normalizeProfile(p: Partial<CrsProfile> | null | undefined): CrsProfile {
  const d = defaultProfile(null);
  const x = { ...d, ...(p || {}) } as CrsProfile;
  x.en = { ...d.en, ...(p?.en || {}) }; x.fr = { ...d.fr, ...(p?.fr || {}) };
  x.sp = { ...d.sp, ...(p?.sp || {}), lang: { ...d.sp.lang, ...(p?.sp?.lang || {}) } };
  return x;
}

/* ---------- draws helpers ---------- */
export type Recent = { last: EERound; rounds: EERound[]; min: number; max: number; itas: number; count: number };
export function recent(draws: Draws | null | undefined, cat: string, months = 6): Recent | null {
  if (!draws || !draws.ee) return null;
  const all = draws.ee.rounds.filter((r) => r.cat === cat);
  if (!all.length) return null;
  const since = new Date(all[0].date); since.setMonth(since.getMonth() - months);
  const rs = all.filter((r) => new Date(r.date) >= since);
  const scores = rs.map((r) => r.crs);
  return { last: all[0], rounds: rs, min: Math.min(...scores), max: Math.max(...scores), itas: rs.reduce((s, r) => s + r.itas, 0), count: rs.length };
}
export function verdict(score: number, rec: Recent | null) {
  if (!rec) return null;
  if (score >= rec.max) return { cls: 'good', text: t('Above every cut-off in the last 6 months') };
  if (score >= rec.last.crs) return { cls: 'good', text: t('Above the latest cut-off') };
  if (score >= rec.min) return { cls: 'warn', text: t('Within the recent range: some rounds would have invited you') };
  return { cls: 'bad', text: t('{n} points below the lowest recent cut-off', { n: rec.min - score }) };
}
export const allAtLeast = (o: Partial<Levels> | null | undefined, n: number) => !!o && SK.every((k) => (Number(o[k]) || 0) >= n);

/* ---------- per-path estimate ---------- */
const FUNDS: Record<number, number> = { 1: 15263, 2: 19001, 3: 23360, 4: 28362 };
export const PATH_DRAWS: Record<string, string> = { 'ee-french': 'french', 'ee-cec': 'cec', pnp: 'pnp' };
const NO_DRAWS: Record<string, string> = {
  c16: tk('No invitation rounds: once you have a job offer, you apply for the work permit directly.'),
  fcip: tk('No invitation rounds: you apply after an employer job offer and a community recommendation.'),
  aip: tk('No federal rounds: an Atlantic employer and the province endorse you. New Brunswick also runs AIP rounds (see Provinces).'),
  fmcsp: tk('No rounds: applications are processed in order until 2,970 study permits or 25 August 2027.'),
  study: tk('No rounds: you need admission, then a study permit.'),
  spouse: tk('No rounds: sponsorship applications are processed in order.')
};

export function lastCutLine(p: Pick<Path, 'id'>, draws: Draws | null | undefined) {
  const cat = PATH_DRAWS[p.id];
  if (cat) { const rec = recent(draws, cat); return rec ? t('Last cut-off {score} · {date}', { score: rec.last.crs, date: fmtDay(rec.last.date, SHORT) }) : ''; }
  if (p.id === 'quebec' && draws && draws.quebec && draws.quebec.rounds[0]) { const r = draws.quebec.rounds[0]; return t('Last Arrima round {date}, min {score}', { date: fmtDay(r.date, SHORT), score: Math.min(...r.groups.map((g) => g[2]).filter((x): x is number => x != null)) }); }
  if (p.id === 'ee-fsw') return t('No general draw since April 2024');
  return '';
}

export type Cost = { items: [string, number][]; total: number; funds: number | null; people: number };
export type Estimate = { status: 'good' | 'close' | 'far' | 'blocked' | 'info'; title: string; lines: string[]; score: number | null; cost?: Cost | null };

export function estimate(p: Path, prof: CrsProfile | null, draws: Draws | null | undefined, levels: AppLevels | null | undefined): Estimate {
  const out: Estimate = { status: 'info', title: '', lines: [], score: null };
  const lv: Partial<AppLevels> = levels || {};
  const fr = prof ? prof.fr : lv.frDetail; const en = prof ? prof.en : lv.enDetail;
  const exp = prof ? (Number(prof.fwExp) || 0) + (Number(prof.caExp) || 0) : 0;
  const r = prof ? crs(prof) : null;
  const cat = PATH_DRAWS[p.id];
  if (r) out.score = r.total;
  const need = (ok: boolean, text: string) => { if (!ok) out.lines.push(text); return ok; };
  if (p.id === 'ee-french' || p.id === 'ee-cec' || (p.id === 'ee-fsw' && prof)) {
    if (!prof || !r) { out.status = 'info'; out.title = t('Calculate your score to see your chances here.'); return out; }
    let ok = true;
    if (p.id === 'ee-french') { ok = need(allAtLeast(fr, 7), t('Needs NCLC 7 in all four French skills')) && ok; ok = need(exp >= 1, t('Needs 1 year of skilled work')) && ok; }
    if (p.id === 'ee-cec') ok = need((Number(prof.caExp) || 0) >= 1, t('Needs 1 year of skilled work in Canada')) && ok;
    if (p.id === 'ee-fsw') { const f = fsw(prof); ok = need(f.eligible, t('Needs CLB 7 in all four skills, 1 year of work and a post-secondary diploma')) && ok; ok = need(f.pass, t('FSW grid {score}/100: needs 67', { score: f.total })) && ok; }
    const c = p.id === 'ee-fsw' ? (allAtLeast(fr, 7) ? 'french' : prof.occ || null) : cat;
    const rec = c ? recent(draws, c) : null;
    if (!ok) { out.status = 'blocked'; out.title = t('Not eligible yet'); }
    else if (!rec) { out.status = 'far'; out.title = t('Eligible, but no general draws since April 2024'); out.lines.push(t('Pick your occupation group in the calculator, or add French NCLC 7, to compare with category rounds.')); }
    else { const v = verdict(r.total, rec)!; out.status = v.cls === 'good' ? 'good' : v.cls === 'warn' ? 'close' : 'far'; out.title = v.text; out.lines.push(t('Your CRS {score} vs {category} rounds: last {last} ({date}), range {min}–{max} in 6 months.', { score: r.total, category: CAT_LABEL[c!] ? t(CAT_LABEL[c!]) : c, last: rec.last.crs, date: fmtDay(rec.last.date, SHORT), min: rec.min, max: rec.max })); }
    const b = boosts(prof).find((x) => !/nomination/.test(x.label));
    if (b && (out.status === 'close' || out.status === 'far')) out.lines.push(t('Biggest gain: {label} (+{gain}).', { label: t(b.label), gain: b.gain }));
  } else if (p.id === 'pnp') {
    const rec = recent(draws, 'pnp');
    out.status = 'info'; out.title = t('Depends on getting a nomination');
    if (r && rec && prof) { const base = prof.pnp ? r.total - 600 : r.total; const vars = { base, total: base + 600, min: rec.min, max: rec.max }; out.lines.push(base + 600 >= rec.max ? t('With a nomination: {base} + 600 = {total}, above every PNP cut-off range ({min}–{max}).', vars) : t('With a nomination: {base} + 600 = {total}, compared with the PNP cut-off range ({min}–{max}).', vars)); }
    out.lines.push(t('Ontario closed its French stream on 30 May 2026; New Brunswick and Manitoba still run francophone rounds.'));
  } else if (p.id === 'ee-fsw') {
    out.title = t('Calculate your score to see your chances here.');
  } else if (p.id === 'quebec') {
    const oral = fr ? Math.min(fr.L || 0, fr.S || 0) : 0, wr = fr ? (fr.W || 0) : 0;
    if (fr && oral >= 7 && wr >= 5) { out.status = 'close'; out.title = t('French level fits stream 1'); }
    else if (fr && oral >= 5) { out.status = 'close'; out.title = t('French level fits stream 2 (TEER 3–5)'); out.lines.push(t('Stream 1 needs NCLC 7 oral and 5 written.')); }
    else { out.status = 'blocked'; out.title = t('Needs NCLC 7 oral (stream 1) or 5 (stream 2)'); }
    const q = draws && draws.quebec && draws.quebec.rounds[0];
    if (q) out.lines.push(t('Latest round {date}: minimum Arrima scores {scores} (Québec\'s own scale).', { date: fmtDay(q.date, SHORT), scores: q.groups.map((g) => g[2]).filter((x) => x != null).join(', ') }));
  } else if (['c16', 'fcip', 'fmcsp'].includes(p.id)) {
    const okFr = p.id === 'c16' ? !!fr && Math.min(fr.L || 0, fr.S || 0) >= 5 : allAtLeast(fr, 5);
    out.status = okFr ? 'close' : 'blocked';
    out.title = okFr ? t('Your French level qualifies') : (p.id === 'c16' ? t('Needs NCLC 5 in speaking and listening') : t('Needs NCLC 5 in all four French skills'));
    out.lines.push(p.id === 'fmcsp' ? t('Next: admission to a participating program taught at least 50% in French.') : p.id === 'fcip' ? t('Next: a job offer from a designated employer in one of the 6 communities.') : t('Next: a job offer from an employer outside Québec.'));
  } else if (p.id === 'aip') {
    const ok = allAtLeast(en, 5) || allAtLeast(fr, 5);
    out.status = ok ? 'close' : 'blocked'; out.title = ok ? t('Your language level qualifies (TEER 0–3)') : t('Needs CLB/NCLC 5 in all four skills');
    out.lines.push(t('Next: a job offer from a designated Atlantic employer.'));
  } else if (p.id === 'study') { out.title = t('Depends on admission and funds'); }
  else if (p.id === 'spouse') { out.title = t('Only if your partner is a Canadian citizen or PR'); }
  if (NO_DRAWS[p.id]) out.lines.push(t(NO_DRAWS[p.id]));
  out.cost = costFor(p, prof);
  return out;
}

export function costFor(p: Pick<Path, 'id'>, prof: CrsInput | null): Cost | null {
  const adults = 1 + (prof && prof.spouse === 'with' ? 1 : 0);
  const kids = prof ? Number(prof.kids) || 0 : 0;
  const people = adults + kids;
  const bio = people > 1 ? 170 : 85;
  if (p.id === 'spouse') return { items: [[tk('Sponsorship + processing + right of PR'), 1255], [tk('Biometrics'), 85]], total: 1340, funds: null, people };
  if (['study', 'fmcsp'].includes(p.id)) return null;
  const items: [string, number][] = [[tk('PR processing, CAD 990 per adult'), 990 * adults], [tk('Right of PR fee, CAD 600 per adult'), 600 * adults]];
  if (kids) items.push([tk('Children, about CAD 270 each'), 270 * kids]);
  items.push([tk('Biometrics'), bio]);
  if (p.id.startsWith('ee') || p.id === 'pnp') items.push([tk('Diploma assessment (ECA), about'), 260]);
  items.push([tk('Language test(s), about'), p.id === 'ee-french' && prof && allAtLeast(prof.en, 5) ? 600 : 300]);
  const total = items.reduce((s, x) => s + x[1], 0);
  const needFunds = ['ee-french', 'ee-fsw', 'pnp', 'fcip', 'aip'].includes(p.id);
  return { items, total, funds: needFunds ? (FUNDS[people] || null) : null, people };
}
