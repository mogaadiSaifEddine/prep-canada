// Extract every translatable English string: t('…'), tk('…') and tr('…') in the interface, plus server
// error messages (err(status, code, '…')) which the app shows through t(e.message).
// The IELTS / TEF coach screens and the admin page are not translated, so they are not scanned.
// npx tsx scripts/i18n-keys.mts            → writes scripts/i18n-keys.json and prints a summary
// npm run i18n:check                       → also lists keys missing from fr.ts / ar.ts (exit 1 if any)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const UI = [...walk('app'), ...walk('components'), ...walk('lib/client'), ...walk('lib/shared'), 'lib/i18n/index.ts']
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('components/coach') && !f.startsWith('app/admin') && !f.startsWith('app/api'));
const SERVER = walk('lib/server').filter((f) => f.endsWith('.ts'));
const lit = String.raw`'((?:[^'\\\n]|\\.)*)'`;
const reT = new RegExp(String.raw`\b(?:tk|tr|t)\(\s*` + lit, 'g');
const reErr = new RegExp(String.raw`\berrT?\(\s*\d+\s*,\s*'[^']*'\s*,\s*` + lit, 'g');
const unesc = (s: string) => s.replace(/\\(.)/g, (m, c) => (({ n: '\n', t: '\t' } as Record<string, string>)[c] || c));

const keys = new Map<string, Set<string>>();
const add = (k: string, file: string) => { if (!k.trim()) return; if (!keys.has(k)) keys.set(k, new Set()); keys.get(k)!.add(file); };
for (const f of UI) { let src; try { src = readFileSync(join(root, f), 'utf8'); } catch { continue; } for (const m of src.matchAll(reT)) add(unesc(m[1]), f); }
for (const f of SERVER) { const src = readFileSync(join(root, f), 'utf8'); for (const m of src.matchAll(reErr)) add(unesc(m[1]), f); }
// Draw data labels shown through t() (bundled Québec groups / provinces / notes)
try {
  const { BUNDLED } = await import(join(root, 'lib/server/draws.ts'));
  add(BUNDLED.ee.note, 'lib/draws.js'); add(BUNDLED.quebec.note, 'lib/draws.js'); add(BUNDLED.provinces.note, 'lib/draws.js');
  for (const r of BUNDLED.quebec.rounds) for (const g of r.groups) add(g[0], 'lib/draws.js');
  for (const r of BUNDLED.provinces.rounds) add(r.stream, 'lib/draws.js');
  for (const n of BUNDLED.provinces.news) add(n, 'lib/draws.js');
} catch (e) { console.warn('draws labels skipped:', (e as Error).message); }

const list = [...keys.keys()].sort();
writeFileSync(join(root, 'scripts/i18n-keys.json'), JSON.stringify(list, null, 1));
console.log(list.length + ' keys (' + UI.length + ' UI files + server messages + draw labels) → scripts/i18n-keys.json');


if (process.argv.includes('--check')) {
  let missing = 0;
  for (const l of ['fr', 'ar']) {
    const d = (await import(join(root, 'lib/i18n/' + l + '.ts'))).default as Record<string, string>;
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
