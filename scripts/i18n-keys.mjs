// Extract every translatable English string: t('…') and tk('…') in the UI modules, plus server
// error messages (err(status, code, '…')) which the app shows through t(e.message).
// node scripts/i18n-keys.mjs            → writes scripts/i18n-keys.json and prints a summary
// node scripts/i18n-keys.mjs --check    → also lists keys missing from fr.js / ar.js (exit 1 if any)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI = ['public/js/main.js', 'public/js/pathsview.js', 'public/js/scoretools.js', 'public/js/pathmap.js', 'public/js/crs.js', 'public/js/i18n.js'];
const SERVER = readdirSync(join(root, 'lib')).filter((f) => f.endsWith('.js')).map((f) => 'lib/' + f);
const lit = String.raw`'((?:[^'\\\n]|\\.)*)'`;
const reT = new RegExp(String.raw`\bt[k]?\(\s*` + lit, 'g');
const reErr = new RegExp(String.raw`\berrT?\(\s*\d+\s*,\s*'[^']*'\s*,\s*` + lit, 'g');
const unesc = (s) => s.replace(/\\(.)/g, (m, c) => ({ n: '\n', t: '\t' }[c] || c));

const keys = new Map();
const add = (k, file) => { if (!k.trim()) return; if (!keys.has(k)) keys.set(k, new Set()); keys.get(k).add(file); };
for (const f of UI) { let src; try { src = readFileSync(join(root, f), 'utf8'); } catch { continue; } for (const m of src.matchAll(reT)) add(unesc(m[1]), f); }
for (const f of SERVER) { const src = readFileSync(join(root, f), 'utf8'); for (const m of src.matchAll(reErr)) add(unesc(m[1]), f); }
// Draw data labels shown through t() (bundled Québec groups / provinces / notes)
try {
  const { BUNDLED } = await import(join(root, 'lib/draws.js'));
  add(BUNDLED.ee.note, 'lib/draws.js'); add(BUNDLED.quebec.note, 'lib/draws.js'); add(BUNDLED.provinces.note, 'lib/draws.js');
  for (const r of BUNDLED.quebec.rounds) for (const g of r.groups) add(g[0], 'lib/draws.js');
  for (const r of BUNDLED.provinces.rounds) add(r.stream, 'lib/draws.js');
  for (const n of BUNDLED.provinces.news) add(n, 'lib/draws.js');
} catch (e) { console.warn('draws labels skipped:', e.message); }

const list = [...keys.keys()].sort();
writeFileSync(join(root, 'scripts/i18n-keys.json'), JSON.stringify(list, null, 1));
console.log(list.length + ' keys (' + UI.length + ' UI files + server messages + draw labels) → scripts/i18n-keys.json');

if (process.argv.includes('--check')) {
  let missing = 0;
  for (const l of ['fr', 'ar']) {
    const d = (await import(join(root, 'public/js/i18n/' + l + '.js') + '?v=' + Date.now())).default;
    const miss = list.filter((k) => !d[k]);
    const extra = Object.keys(d).filter((k) => !keys.has(k));
    // placeholders must survive translation
    const bad = list.filter((k) => d[k] && (k.match(/\{\w+\}/g) || []).sort().join() !== (d[k].match(/\{\w+\}/g) || []).sort().join());
    console.log(l + ': ' + (list.length - miss.length) + '/' + list.length + ' translated, ' + extra.length + ' unused, ' + bad.length + ' placeholder mismatches');
    miss.slice(0, 30).forEach((k) => console.log('  missing: ' + k.slice(0, 90)));
    bad.slice(0, 30).forEach((k) => console.log('  placeholders: ' + k.slice(0, 90)));
    missing += miss.length + bad.length;
  }
  process.exit(missing ? 1 : 0);
}
