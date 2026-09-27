// @ts-nocheck -- test fixtures pass partial profiles and paths on purpose
// CRS / FSW / draws parsing checks. npm run test:crs
import { crs, fsw, boosts, poolAbove } from '../lib/shared/crs';
import { parseFeed, eeCategory, BUNDLED } from '../lib/server/draws';
import { estimate, costFor, recent } from '../lib/shared/scoretools';

let fails = 0;
const eq = (name, got, want) => { const ok = got === want; if (!ok) fails++; console.log((ok ? '✓ ' : '✗ ') + name + (ok ? '' : ' — got ' + got + ', want ' + want)); };
const L = (n) => ({ L: n, R: n, W: n, S: n });

// 1. Single, 29, master's, CLB 9 English, 3 years abroad: 110 + 135 + 124 + 100 = 469
const a = { age: 29, spouse: 'single', edu: 'mast', en: L(9), fr: L(0), fwExp: 3, caExp: 0 };
eq('single master CLB9 3y abroad', crs(a).total, 469);
// 2. Same + French NCLC 7: second language 12 + French bonus 50 = 531
eq('… + NCLC 7 French', crs({ ...a, fr: L(7) }).total, 531);
// 3. Married, 30, bachelor, CLB 8, partner bachelor CLB 7, 2 years abroad
//    core 95 + 112 + 88 = 295; partner 8 + 12 = 20; transfer 13 + 13 = 26 → 341
eq('married bachelor CLB8', crs({ age: 30, spouse: 'with', edu: 'bach', en: L(8), fr: L(0), fwExp: 2, caExp: 0, sp: { edu: 'bach', lang: L(7), caExp: 0 } }).total, 341);
// 4. French as first language: NCLC 9 French, CLB 5 English, single 33, master, 3 yrs
//    age 88, edu 135, lang1 31×4 = 124, lang2 1×4 = 4, transfer 50 + 50, French bonus 50 → 501
eq('French first language', crs({ age: 33, spouse: 'single', edu: 'mast', en: L(5), fr: L(9), fwExp: 3, caExp: 0 }).total, 501);
// 5. CEC: 27, bachelor, CLB 10, 1 year in Canada, 1-2y Canadian studies
//    age 110, edu 120, lang 136, cdn exp 40 = 406; transfer edu+lang 25 + edu+ca 13 = 38; caEdu 15 → 459
eq('CEC profile', crs({ age: 27, spouse: 'single', edu: 'bach', en: L(10), fr: L(0), fwExp: 0, caExp: 1, caEdu: '1' }).total, 459);
// 6. Nomination adds 600, capped extras
eq('with PNP', crs({ ...a, pnp: true }).total, 1069);
// 7. Age 45 → 0 age points
eq('age 45', crs({ ...a, age: 45 }).core.age, 0);

// FSW grid: CLB 9 (24) + master (23) + 3 years (11) + age 29 (12) = 70
eq('FSW 70', fsw(a).total, 70);
eq('FSW pass', fsw(a).pass && fsw(a).eligible, true);
eq('FSW needs CLB 7', fsw({ ...a, en: L(6) }).eligible, false);

// Boosts: French NCLC 7 is the biggest for profile a
eq('top boost is a nomination', boosts(a)[0].label, 'A provincial nomination');
eq('French boost +62', boosts(a).find((b) => /French NCLC 7/.test(b.label)).gain, 62);

// Pool
const pa = poolAbove(BUNDLED.ee.dist, 600);
eq('pool above 600 ≈ 574', pa.above, 574);

// Feed parsing (shape from IRCC's JSON)
const feed = { rounds: [{ drawNumber: '444', drawDate: '2026-09-16', drawName: 'Senior managers with Canadian Work Experience, 2026-Version 1', drawSize: '250', drawCRS: '389', drawDistributionAsOn: 'September 13, 2026', dd1: '574', dd2: '20,784', dd4: '12,590', dd5: '12,426', dd6: '16,105', dd7: '16,163', dd8: '14,823', dd10: '13,657', dd11: '13,300', dd12: '12,064', dd13: '11,506', dd14: '11,033', dd15: '46,782', dd16: '17,240', dd17: '7,746', dd18: '226,793' }, { drawNumber: '437', drawDate: '2026-08-19', drawName: 'French language proficiency (Version 1)', drawSize: '5,000', drawCRS: '382' }] };
const pf = parseFeed(feed);
eq('feed rounds', pf.rounds.length, 2);
eq('feed cat', pf.rounds[1].cat, 'french');
eq('feed itas', pf.rounds[1].itas, 5000);
eq('feed dist total', pf.dist.total, 226793);
eq('feed dist date', pf.dist.asOf, '2026-09-13');
eq('category CEC', eeCategory('Canadian Experience Class, 2026-Version 3'), 'cec');

// Estimates
const d = { ...BUNDLED };
eq('recent french last', recent(d, 'french').last.crs, 382);
eq('French path: a + NCLC 7 is above', estimate({ id: 'ee-french', time: '' }, { ...a, fr: L(7) }, d).status, 'good');
eq('French path blocked without NCLC 7', estimate({ id: 'ee-french', time: '' }, a, d).status, 'blocked');
eq('CEC blocked abroad', estimate({ id: 'ee-cec', time: '' }, a, d).status, 'blocked');
eq('fees single EE', costFor({ id: 'ee-french' }, a).total, 990 + 600 + 85 + 260 + 600); // English + French tests
eq('funds couple + 1 child', costFor({ id: 'ee-fsw' }, { ...a, spouse: 'with', kids: 1 }).funds, 23360);

console.log(fails ? '\n' + fails + ' failed' : '\nall passed');
process.exit(fails ? 1 : 0);
