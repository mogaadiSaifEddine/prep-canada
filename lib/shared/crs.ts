// Express Entry scores: the Comprehensive Ranking System (CRS, out of 1,200) and the
// Federal Skilled Worker 67-point grid. Official grids as published by IRCC, in force on
// 27 September 2026 (job-offer points were removed from CRS on 25 March 2025).
// Pure functions: no DOM, so they can be tested in Node (npm run test:crs).
// Labels are English keys marked with tk(); the UI translates them with t() when rendering.
import { tk } from '../i18n';

export type Levels = { L: number; R: number; W: number; S: number };
export type SpouseInfo = { edu: string; lang: Levels; caExp: number };
/** Everything the calculator asks. Tests and helpers may pass only part of it. */
export type CrsProfile = {
  age: number; spouse: 'single' | 'with'; edu: string; caEdu: string; en: Levels; fr: Levels; fwExp: number; caExp: number;
  cert: boolean; pnp: boolean; sibling: boolean; offer: boolean; relative: boolean; spStudyCa: boolean; occ: string; kids: number; sp: SpouseInfo;
};
export type CrsInput = Partial<Omit<CrsProfile, 'sp' | 'en' | 'fr'>> & { en?: Partial<Levels>; fr?: Partial<Levels>; sp?: Partial<Omit<SpouseInfo, 'lang'>> & { lang?: Partial<Levels> } };
type LevelMap = Partial<Levels> | undefined;

export const EDU: [string, string][] = [
  ['none', tk('Less than secondary school')],
  ['sec', tk('Secondary school (bac)')],
  ['1yr', tk('One-year post-secondary program')],
  ['2yr', tk('Two-year post-secondary program (e.g. BTS)')],
  ['bach', tk('Bachelor\'s degree or 3+ year program (licence)')],
  ['two', tk('Two or more credentials, one of them 3+ years')],
  ['mast', tk('Master\'s or professional degree (mastère, engineer, doctor of medicine…)')],
  ['phd', tk('Doctorate (PhD)')]
];
const SKILLS = ['L', 'R', 'W', 'S'] as const;
const pick = (tbl: [number, number][], v: number) => { for (const [min, pts] of tbl) if (v >= min) return pts; return 0; };
const minOf = (o: LevelMap) => (o ? Math.min(...SKILLS.map((k) => Number(o[k]) || 0)) : 0);
const allAtLeast = (o: LevelMap, n: number) => !!o && SKILLS.every((k) => (Number(o[k]) || 0) >= n);

/* ---------- CRS tables: [with spouse, without spouse] ---------- */
const AGE: Record<number, [number, number]> = { 18: [90, 99], 19: [95, 105], 20: [100, 110], 30: [95, 105], 31: [90, 99], 32: [85, 94], 33: [80, 88], 34: [75, 83], 35: [70, 77], 36: [65, 72], 37: [60, 66], 38: [55, 61], 39: [50, 55], 40: [45, 50], 41: [35, 39], 42: [25, 28], 43: [15, 17], 44: [5, 6] };
function agePts(ageIn: unknown, i: number) {
  const age = Number(ageIn) || 0;
  if (age < 18 || age >= 45) return 0;
  if (age >= 20 && age <= 29) return AGE[20][i];
  return AGE[age][i];
}
const EDU_PTS: Record<string, [number, number]> = { none: [0, 0], sec: [28, 30], '1yr': [84, 90], '2yr': [91, 98], bach: [112, 120], two: [119, 128], mast: [126, 135], phd: [140, 150] };
const L1: [number, [number, number]][] = [[10, [32, 34]], [9, [29, 31]], [8, [22, 23]], [7, [16, 17]], [6, [8, 9]], [4, [6, 6]]];
const l1Pts = (clb: number, i: number) => { for (const [m, p] of L1) if (clb >= m) return p[i]; return 0; };
const l2Pts = (clb: number) => pick([[9, 6], [7, 3], [5, 1]], clb);
const CA_EXP: [number, [number, number]][] = [[5, [70, 80]], [4, [63, 72]], [3, [56, 64]], [2, [46, 53]], [1, [35, 40]]];
const caExpPts = (y: number, i: number) => { for (const [m, p] of CA_EXP) if (y >= m) return p[i]; return 0; };
// Spouse factors
const SP_EDU: Record<string, number> = { none: 0, sec: 2, '1yr': 6, '2yr': 7, bach: 8, two: 9, mast: 10, phd: 10 };
const spLang = (clb: number) => pick([[9, 5], [7, 3], [5, 1]], clb);
const spCa = (y: number) => pick([[5, 10], [4, 9], [3, 8], [2, 7], [1, 5]], y);

// Which official language counts as "first": the one worth more points.
function languages(p: CrsInput) {
  const i = p.spouse === 'with' ? 0 : 1;
  const en: Partial<Levels> = p.en || {}, fr: Partial<Levels> = p.fr || {};
  const score = (o: Partial<Levels>) => SKILLS.reduce((s, k) => s + l1Pts(Number(o[k]) || 0, i), 0);
  const enFirst = score(en) >= score(fr);
  return { first: enFirst ? en : fr, second: enFirst ? fr : en, firstName: enFirst ? 'English' : 'French' };
}

export function crs(p: CrsInput) {
  const i = p.spouse === 'with' ? 0 : 1;
  const { first, second, firstName } = languages(p);
  const caExp = Math.min(5, Number(p.caExp) || 0);
  const fwExp = Number(p.fwExp) || 0;

  const core = {
    age: agePts(p.age, i),
    edu: (EDU_PTS[p.edu || ''] || [0, 0])[i],
    lang1: SKILLS.reduce((s, k) => s + l1Pts(Number(first[k]) || 0, i), 0),
    lang2: Math.min(i === 0 ? 22 : 24, SKILLS.reduce((s, k) => s + l2Pts(Number(second[k]) || 0), 0)),
    caExp: caExpPts(caExp, i)
  };
  const sp: NonNullable<CrsInput['sp']> = p.sp || {};
  const spouse = i === 0 ? {
    edu: SP_EDU[sp.edu || ''] || 0,
    lang: Math.min(20, SKILLS.reduce((s, k) => s + spLang(Number((sp.lang || {})[k]) || 0), 0)),
    caExp: spCa(Number(sp.caExp) || 0)
  } : { edu: 0, lang: 0, caExp: 0 };

  // Skill transferability (max 100)
  const eduG = ['1yr', '2yr', 'bach'].includes(p.edu || '') ? 1 : ['two', 'mast', 'phd'].includes(p.edu || '') ? 2 : 0;
  const lMin = minOf(first);
  const langT = lMin >= 9 ? 2 : lMin >= 7 ? 1 : 0;
  const caT = caExp >= 2 ? 2 : caExp >= 1 ? 1 : 0;
  const fwT = fwExp >= 3 ? 2 : fwExp >= 1 ? 1 : 0;
  const T = [[0, 0, 0], [0, 13, 25], [0, 25, 50]];
  const eduLang = T[eduG][langT], eduCa = T[eduG][caT];
  const fwLang = T[fwT][langT], fwCa = T[fwT][caT];
  const cert = p.cert ? (lMin >= 7 ? 50 : lMin >= 5 ? 25 : 0) : 0;
  const transfer = {
    education: Math.min(50, eduLang + eduCa),
    foreign: Math.min(50, fwLang + fwCa),
    cert
  };
  const transferTotal = Math.min(100, transfer.education + transfer.foreign + transfer.cert);

  // Additional points (max 600)
  const frAll7 = allAtLeast(p.fr, 7);
  const french = frAll7 ? (allAtLeast(p.en, 5) ? 50 : 25) : 0;
  const additional = {
    pnp: p.pnp ? 600 : 0,
    french,
    caEdu: p.caEdu === '3' ? 30 : p.caEdu === '1' ? 15 : 0,
    sibling: p.sibling ? 15 : 0
  };
  const addTotal = Math.min(600, Object.values(additional).reduce((a, b) => a + b, 0));
  const coreTotal = Object.values(core).reduce((a, b) => a + b, 0);
  const spTotal = spouse.edu + spouse.lang + spouse.caExp;
  return {
    total: coreTotal + spTotal + transferTotal + addTotal,
    core, coreTotal, spouse, spTotal, transfer, transferTotal, additional, addTotal, firstName
  };
}

/* ---------- FSW 67-point grid ---------- */
export function fsw(p: CrsInput) {
  const { first, second } = languages(p);
  const fwExp = Number(p.fwExp) || 0, caExp = Number(p.caExp) || 0;
  const years = fwExp + caExp;
  const age = Number(p.age) || 0;
  const lang1 = SKILLS.reduce((s, k) => s + pick([[9, 6], [8, 5], [7, 4]], Number(first[k]) || 0), 0);
  const lang2 = allAtLeast(second, 5) ? 4 : 0;
  const edu = ({ none: 0, sec: 5, '1yr': 15, '2yr': 19, bach: 21, two: 22, mast: 23, phd: 25 } as Record<string, number>)[p.edu || ''] || 0;
  const exp = pick([[6, 15], [4, 13], [2, 11], [1, 9]], years);
  const agePts = age < 18 ? 0 : age <= 35 ? 12 : Math.max(0, 12 - (age - 35));
  const offer = p.offer ? 10 : 0;
  const sp: NonNullable<CrsInput['sp']> = p.sp || {};
  const hasSp = p.spouse === 'with';
  const adapt = Math.min(10,
    (hasSp && allAtLeast(sp.lang, 4) ? 5 : 0) +
    (p.caEdu && p.caEdu !== '0' ? 5 : 0) +
    (hasSp && p.spStudyCa ? 5 : 0) +
    (caExp >= 1 ? 10 : 0) +
    (hasSp && (Number(sp.caExp) || 0) >= 1 ? 5 : 0) +
    (p.offer ? 5 : 0) +
    (p.relative ? 5 : 0));
  const total = Math.min(24, lang1) + lang2 + edu + exp + agePts + offer + adapt;
  const eligible = allAtLeast(first, 7) && years >= 1 && !!p.edu && p.edu !== 'none';
  return { total, pass: total >= 67, eligible, parts: { lang1: Math.min(24, lang1), lang2, edu, exp, age: agePts, offer, adapt } };
}

/* ---------- "what if" boosts ---------- */
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o || {}));
const raise = (o: LevelMap, n: number) => { const x: Record<string, number> = clone((o || {}) as Record<string, number>); SKILLS.forEach((k) => { x[k] = Math.max(Number(x[k]) || 0, n); }); return x; };
export type Boost = { label: string; gain: number; total: number; how: string };
export function boosts(p: CrsInput) {
  const base = crs(p).total;
  const tries: Boost[] = [];
  const tr = (label: string, q: CrsInput, how: string) => { const v = crs(q).total; if (v > base) tries.push({ label, gain: v - base, total: v, how }); };
  if (!allAtLeast(p.fr, 7)) tr(tk('French NCLC 7 in all four skills'), { ...clone(p), fr: raise(p.fr, 7) }, tk('Also opens the French-language draws, the biggest in 2026.'));
  if (allAtLeast(p.fr, 7) && !allAtLeast(p.fr, 9)) tr(tk('French NCLC 9 in all four skills'), { ...clone(p), fr: raise(p.fr, 9) }, tk('More points as a second (or first) language.'));
  if (!allAtLeast(p.en, 9)) tr(tk('English CLB 9 in all four skills (IELTS L8 R7 W7 S7)'), { ...clone(p), en: raise(p.en, 9) }, tk('CLB 9 unlocks the top skill-transferability points.'));
  else if (!allAtLeast(p.en, 10)) tr(tk('English CLB 10 in all four skills'), { ...clone(p), en: raise(p.en, 10) }, '');
  if ((Number(p.caExp) || 0) < 1) tr(tk('One year of skilled work in Canada'), { ...clone(p), caExp: 1 }, tk('Also makes you eligible for CEC.'));
  if (!['mast', 'phd'].includes(p.edu || '')) tr(tk('A master\'s degree (assessed)'), { ...clone(p), edu: 'mast' }, '');
  if (p.spouse === 'with' && !allAtLeast((p.sp || {}).lang, 7)) tr(tk('Your partner reaches CLB/NCLC 7'), { ...clone(p), sp: { ...clone(p.sp), lang: raise((p.sp || {}).lang, 7) } }, '');
  if (!p.pnp) tr(tk('A provincial nomination'), { ...clone(p), pnp: true }, tk('Practically guarantees an invitation.'));
  return tries.sort((a, b) => b.gain - a.gain);
}

// How many candidates in the pool have a higher score (IRCC distribution, linear inside a bucket)
export function poolAbove(dist: { asOf: string | null; total: number; buckets: [number, number, number][] } | null | undefined, score: number) {
  if (!dist || !dist.buckets) return null;
  let above = 0;
  for (const [lo, hi, n] of dist.buckets) {
    if (score < lo) above += n;
    else if (score <= hi) above += Math.round(n * (hi - score) / (hi - lo + 1));
  }
  return { above, total: dist.total, pct: dist.total ? Math.round(100 * above / dist.total) : null, asOf: dist.asOf };
}

// Official score → CLB/NCLC (IRCC equivalency charts)
export type LevelTable = Record<'L' | 'R' | 'W' | 'S', [number, number][]>;
export const IELTS_CLB: LevelTable = { L: [[8.5, 10], [8, 9], [7.5, 8], [6, 7], [5.5, 6], [5, 5], [4.5, 4]], R: [[8, 10], [7, 9], [6.5, 8], [6, 7], [5, 6], [4, 5], [3.5, 4]], W: [[7.5, 10], [7, 9], [6.5, 8], [6, 7], [5.5, 6], [5, 5], [4, 4]], S: [[7.5, 10], [7, 9], [6.5, 8], [6, 7], [5.5, 6], [5, 5], [4, 4]] };
export const TEF_NCLC: LevelTable = { L: [[546, 10], [503, 9], [462, 8], [434, 7], [393, 6], [352, 5], [306, 4]], R: [[546, 10], [503, 9], [462, 8], [434, 7], [393, 6], [352, 5], [306, 4]], W: [[558, 10], [512, 9], [472, 8], [428, 7], [379, 6], [330, 5], [268, 4]], S: [[556, 10], [518, 9], [494, 8], [456, 7], [422, 6], [387, 5], [328, 4]] };
export const toLevel = (t: LevelTable, k: 'L' | 'R' | 'W' | 'S', v: unknown) => { if (v == null || v === '') return 0; for (const [m, n] of t[k]) if (Number(v) >= m) return n; return 3; };
