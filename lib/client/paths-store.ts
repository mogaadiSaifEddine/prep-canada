// Immigration paths state: the learner's journey (stops done, chosen path, finder answers, score
// profile), their language levels from the coaches, and the latest invitation rounds.
// Signed-in: saved in the account (docs namespace "journey"). Visitors: kept on this device, then
// moved into the account at sign-up.
import { useSyncExternalStore } from 'react';
import * as PEN from '../paths/en';
import type { Path, PathsModule } from '../paths/types';
import { huePaths } from '../shared/palette';
import { crs, IELTS_CLB, TEF_NCLC, type CrsProfile, type LevelTable, type Levels } from '../shared/crs';
import { normalizeProfile, recent, type AppLevels } from '../shared/scoretools';
import type { Draws } from '../shared/types';
import { lang, t, tk } from '../i18n';
import { getDoc, putDoc } from './api';
import { bridge } from './bridge';

export type Finder = Record<string, string>;
export type Journey = { progress: Record<string, Record<string, string>>; pinned: string | null; finder: Finder | null; profile: CrsProfile | null; savedAt?: string };

/* ---------- path content per language (French / Arabic load on first use) ---------- */
const PDATA: Partial<Record<string, PathsModule>> = { en: PEN };
huePaths(PEN.PATHS);
async function ensurePaths() {
  const l = lang();
  if ((l === 'fr' || l === 'ar') && !PDATA[l]) {
    const m: PathsModule = await (l === 'fr' ? import('../paths/fr') : import('../paths/ar')).catch(() => PEN);
    huePaths(m.PATHS); PDATA[l] = m; emit();
  }
}
/** The path data in the current interface language. Links always come from the English module. */
export const P = (): PathsModule => PDATA[lang()] || PEN;
export const LINKS = PEN.LINKS;

/* ---------- visitor storage ---------- */
const LS = 'pc_journey';
const emptyJourney = (): Journey => ({ progress: {}, pinned: null, finder: null, profile: null });
// Saved docs can be partial (older app, hand edits): always hand back the full shape.
function normalizeJourney(raw: unknown): Journey {
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { /* keep as is */ } }
  const j: any = raw && typeof raw === 'object' ? raw : emptyJourney();
  j.progress = j.progress && typeof j.progress === 'object' ? j.progress : {};
  j.pinned = j.pinned ?? null; j.finder = j.finder ?? null; j.profile = j.profile ?? null;
  return j as Journey;
}
function readLocal(): Journey {
  let j: any = null;
  try { j = JSON.parse(localStorage.getItem(LS) || 'null'); } catch { j = null; }
  j = normalizeJourney(j);
  try { const old = JSON.parse(localStorage.getItem('pc_profile') || 'null'); if (old && !j.profile) j.profile = old; localStorage.removeItem('pc_profile'); } catch { /* ignore */ }
  return j as Journey;
}
function writeLocal(j: Journey) { try { localStorage.setItem(LS, JSON.stringify({ ...j, savedAt: new Date().toISOString() })); return true; } catch { return false; } }
function clearLocal() { try { localStorage.removeItem(LS); localStorage.removeItem('pc_profile'); } catch { /* ignore */ } }
const hasData = (j: Partial<Journey> | null | undefined) => !!j && (Object.values(j.progress || {}).some((p) => p && Object.keys(p).length) || !!j.pinned || !!j.finder || !!j.profile);
// Combine two journeys without losing anything: stops done in either, the account's choices first.
export function mergeJourney(acc: Journey | null, loc: Journey | null): Journey {
  const a = acc || emptyJourney(), l = loc || emptyJourney();
  const progress: Journey['progress'] = JSON.parse(JSON.stringify(a.progress || {}));
  for (const [pid, stops] of Object.entries(l.progress || {})) {
    const into = progress[pid] || (progress[pid] = {});
    for (const [sid, date] of Object.entries(stops || {})) if (!into[sid] || String(date) < String(into[sid])) into[sid] = date;
  }
  return { ...l, ...a, progress, pinned: a.pinned || l.pinned || null, finder: a.finder || l.finder || null, profile: a.profile || l.profile || null };
}

/* ---------- state + subscription ---------- */
const lvl = (tb: LevelTable, k: keyof Levels, v: number | null | undefined) => { if (v == null) return null; for (const [m, n] of tb[k]) if (v >= m) return n; return 3; };
type St = {
  journey: Journey | null; levels: AppLevels | null; finder: Finder | null; finderOpen?: boolean;
  visitor: boolean; loading: Promise<void> | null; toldLocal?: boolean;
  draws: Draws | null; drawsAt: number; drawsLoading: Promise<Draws | null> | null; view: 'map' | 'list';
};
const st: St = { journey: null, levels: null, finder: null, visitor: false, loading: null, draws: null, drawsAt: 0, drawsLoading: null, view: 'map' };
let version = 0;
const subs = new Set<() => void>();
function emit() { version++; subs.forEach((f) => f()); }
export function usePaths() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version, () => 0);
}
export const state = st;

export async function loadDraws(): Promise<Draws | null> {
  if (st.draws && Date.now() - st.drawsAt < 10 * 60 * 1000) return st.draws;
  if (!st.drawsLoading) {
    st.drawsLoading = (async () => {
      try { const r = await fetch('/api/draws', { credentials: 'same-origin' }); if (r.ok) { st.draws = await r.json(); st.drawsAt = Date.now(); emit(); } } catch { /* offline: keep what we have */ }
      st.drawsLoading = null;
      return st.draws;
    })();
  }
  return st.drawsLoading;
}

export function load(): Promise<unknown> {
  if (!bridge.me()) {
    if (!st.visitor) { st.journey = readLocal(); st.finder = st.journey.finder || null; st.visitor = true; emit(); }
    return ensurePaths();
  }
  if (!st.loading) st.loading = doLoad().catch((e) => { st.loading = null; throw e; });
  return Promise.all([ensurePaths(), st.loading]);
}
async function doLoad() {
  const [j, ie, te] = await Promise.all([
    getDoc<Journey>('journey', 'progress').catch(() => null),
    getDoc('ielts', 'profile').catch(() => null),
    getDoc('tef', 'profile').catch(() => null)
  ]);
  st.journey = normalizeJourney(j);
  st.finder = st.journey.finder || null;
  const lv: AppLevels = { en: null, fr: null, enDetail: null, frDetail: null };
  const K = ['L', 'R', 'W', 'S'] as const;
  if (ie && ie.bands && K.every((k) => ie.bands[k] != null)) { const d = {} as Levels; K.forEach((k) => { d[k] = lvl(IELTS_CLB, k, ie.bands[k])!; }); lv.en = Math.min(...Object.values(d)); lv.enDetail = d; }
  if (te && te.scores && K.every((k) => te.scores[k] != null)) { const d = {} as Levels; K.forEach((k) => { d[k] = lvl(TEF_NCLC, k, te.scores[k])!; }); lv.fr = Math.min(...Object.values(d)); lv.frDetail = d; }
  st.levels = lv;
  emit();
}
/** Called right after sign-up (always) or login (only if the account has no paths data yet). */
export async function adoptVisitorData(mode: 'signup' | 'login') {
  const loc = readLocal();
  if (!hasData(loc)) return false;
  const acc = await getDoc<Journey>('journey', 'progress').catch(() => null);
  if (mode !== 'signup' && hasData(acc)) return false; // an existing account keeps its own data
  await putDoc('journey', 'progress', mergeJourney(acc, loc));
  clearLocal();
  st.loading = null; st.journey = null;
  return true;
}
export function reset() { st.loading = null; st.visitor = false; st.journey = null; st.levels = null; st.finder = null; emit(); }

export const journey = (): Journey => st.journey || (st.journey = emptyJourney());
let saveT: ReturnType<typeof setTimeout> | undefined;
export function save() {
  emit();
  if (!bridge.me()) {
    if (!writeLocal(journey())) bridge.toast(t('This browser blocks saving (private mode?). Create a free account to keep your progress.'));
    else if (!st.toldLocal) { st.toldLocal = true; setTimeout(() => bridge.toast(t('Saved on this device. Create a free account to keep it everywhere.')), 1400); }
    return;
  }
  clearTimeout(saveT);
  saveT = setTimeout(() => putDoc('journey', 'progress', journey()).catch(() => bridge.toast(t('Your progress could not be saved. Check your connection.'))), 600);
}

/* ---------- queries ---------- */
export const profile = (): CrsProfile | null => { const p = journey().profile; return p ? normalizeProfile(p) : null; };
export function setProfile(p: CrsProfile) { journey().profile = p; save(); }
export const score = () => { const p = profile(); return p ? crs(p).total : null; };
export const doneCount = (p: Path) => p.stops.filter((s) => (journey().progress[p.id] || {})[s.id]).length;
export const nextStop = (p: Path) => { const pr = journey().progress[p.id] || {}; return p.stops.find((s) => !s.optional && !pr[s.id]) || p.stops.find((s) => !pr[s.id]); };
export const findPath = (id: string | null | undefined) => P().PATHS.find((p) => p.id === id) || null;
export function pinnedSummary() {
  const j = st.journey; if (!j || !j.pinned) return null;
  const p = findPath(j.pinned); if (!p) return null;
  return { p, done: doneCount(p), next: nextStop(p) };
}
export const frenchCut = () => { const r = st.draws && recent(st.draws, 'french'); return r ? r.last : null; };
export const cecCut = () => { const r = st.draws && recent(st.draws, 'cec'); return r ? r.last : null; };

/* ---------- actions ---------- */
export function toggleStop(pid: string, sid: string) {
  const pr = journey().progress[pid] || (journey().progress[pid] = {});
  if (pr[sid]) delete pr[sid]; else pr[sid] = new Date().toISOString().slice(0, 10);
  if (!journey().pinned) journey().pinned = pid;
  save();
  return !!pr[sid];
}
export function togglePin(pid: string) { journey().pinned = journey().pinned === pid ? null : pid; save(); }
export function setView(v: 'map' | 'list') { st.view = v; emit(); }

/* ---------- finder ---------- */
export const Q: [string, string, [string, string][]][] = [
  ['where', tk('Where are you now?'), [['abroad', tk('Outside Canada')], ['canada', tk('In Canada (outside Québec) with a permit')], ['quebec', tk('In Québec with a permit')]]],
  ['fr', tk('Your French level'), [['0', tk('None or basic')], ['5', tk('NCLC 5–6')], ['7', tk('NCLC 7+')]]],
  ['en', tk('Your English level'), [['0', tk('None or basic')], ['5', tk('CLB 5–6')], ['7', tk('CLB 7–8')], ['9', tk('CLB 9+')]]],
  ['exp', tk('Skilled work experience (TEER 0–3)'), [['0', tk('Less than 1 year')], ['1', tk('1–2 years')], ['3', tk('3+ years')]]],
  ['cexp', tk('12+ months of skilled work in Canada?'), [['no', tk('No')], ['yes', tk('Yes')]]],
  ['offer', tk('Job offer from a Canadian employer?'), [['no', tk('No')], ['yes', tk('Yes')]]],
  ['partner', tk('Partner who is a Canadian citizen or PR?'), [['no', tk('No')], ['yes', tk('Yes')]]],
  ['study', tk('Open to studying in Canada first?'), [['no', tk('No')], ['yes', tk('Yes')]]]
];
export function finderDefaults(): Finder {
  const f: Finder = { where: 'abroad', fr: '0', en: '0', exp: '1', cexp: 'no', offer: 'no', partner: 'no', study: 'no' };
  const lv: Partial<AppLevels> = st.levels || {};
  if (lv.fr != null) f.fr = lv.fr >= 7 ? '7' : lv.fr >= 5 ? '5' : '0';
  if (lv.en != null) f.en = lv.en >= 9 ? '9' : lv.en >= 7 ? '7' : lv.en >= 5 ? '5' : '0';
  return f;
}
export function setFinder(f: Finder | null) { st.finder = f; st.finderOpen = false; journey().finder = f; save(); }
export type Ranked = { id: string; score: number; why: string };
export function rank(f: Finder): Ranked[] {
  const fr = Number(f.fr), en = Number(f.en), exp = Number(f.exp);
  const inCa = f.where !== 'abroad';
  const out: Ranked[] = [];
  const add = (id: string, sc: number, why: string) => out.push({ id, score: sc, why });
  if (f.partner === 'yes') add('spouse', 95, t('Your partner can sponsor you directly.'));
  add('ee-french', fr >= 7 && exp >= 1 ? 90 : fr >= 5 && exp >= 1 ? 55 : 10, fr >= 7 && exp >= 1 ? t('NCLC 7 + skilled experience: the biggest 2026 draws, cut-offs around 380–420.') : fr >= 5 ? t('Reach NCLC 7 in all four skills to enter the French draws.') : t('Needs NCLC 7 in French.'));
  add('ee-cec', f.cexp === 'yes' && f.where !== 'quebec' ? 88 : inCa ? 45 : 8, f.cexp === 'yes' ? t('You already have Canadian experience.') : t('Needs 12 months of skilled work in Canada.'));
  add('c16', !inCa && fr >= 5 ? 75 : fr >= 5 ? 40 : 12, fr >= 5 ? t('NCLC 5 oral is enough for a no-LMIA work permit outside Québec.') : t('Needs NCLC 5 in speaking and listening.'));
  add('quebec', f.where === 'quebec' && fr >= 5 ? 85 : fr >= 7 ? 45 : 10, f.where === 'quebec' ? t('Québec invites mostly people already living there (PSTQ, and PEQ reopened in 2026).') : t('Strong French helps; 2026 invitations favour people in Québec.'));
  add('fcip', f.offer === 'yes' && fr >= 5 ? 80 : fr >= 5 ? 45 : 10, t('Needs a job offer from a designated employer in one of 6 francophone communities.'));
  add('pnp', f.offer === 'yes' || inCa ? 70 : 35, f.offer === 'yes' || inCa ? t('Provinces favour people with a local job or experience; +600 CRS.') : t('Few streams accept people abroad without a job offer (e.g. Saskatchewan priority sectors).'));
  add('aip', f.offer === 'yes' ? 65 : 25, t('Needs a job offer from a designated employer in the Atlantic provinces.'));
  add('ee-fsw', en >= 9 && exp >= 3 ? 50 : en >= 7 && exp >= 1 ? 30 : 8, en >= 7 ? t('Eligible with CLB 7, but 2026 invitations go to categories and nominees: add French or a category occupation.') : t('Needs CLB 7 in English.'));
  add('fmcsp', f.study === 'yes' && fr >= 5 ? 82 : f.study === 'yes' ? 35 : 15, t('Study in French outside Québec, then direct PR. Tunisia is eligible until August 2027.'));
  add('study', f.study === 'yes' ? 50 : 10, t('The longest route: study, work permit, then PR.'));
  return out.sort((a, b) => b.score - a.score);
}
