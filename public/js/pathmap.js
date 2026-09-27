// Journey map renderer: draws a path as a winding road from Tunisia, across the sea, to Canada,
// with one pin per stop. Pure SVG, sized to the available width, deterministic per path.
// The geometry is left-to-right in every language (direction:ltr on the <svg>); text is translated.
import { t, lang } from './i18n.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Catmull-Rom through points → list of cubic segments
function segments(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    out.push({ a: p1, c1, c2, b: p2 });
  }
  return out;
}
const segD = (segs) => segs.length ? 'M' + segs[0].a.map(f).join(' ') + segs.map((s) => ' C' + s.c1.map(f).join(' ') + ' ' + s.c2.map(f).join(' ') + ' ' + s.b.map(f).join(' ')).join('') : '';
const f = (n) => Math.round(n * 10) / 10;
function sample(seg, n) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, u = 1 - t;
    pts.push([u * u * u * seg.a[0] + 3 * u * u * t * seg.c1[0] + 3 * u * t * t * seg.c2[0] + t * t * t * seg.b[0], u * u * u * seg.a[1] + 3 * u * u * t * seg.c1[1] + 3 * u * t * t * seg.c2[1] + t * t * t * seg.b[1]]);
  }
  return pts;
}
function wrap(text, max, lines = 2) {
  const words = String(text).split(/\s+/); const out = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; if (out.length === lines) break; } else cur = (cur + ' ' + w).trim();
  }
  if (out.length < lines && cur) out.push(cur);
  const used = out.join(' ').split(/\s+/).length;
  if (used < words.length && out.length) out[out.length - 1] = out[out.length - 1].replace(/\s*\S*$/, '') + '…';
  return out;
}

/* decorations (drawn at 0,0; scaled) */
const DECOR = {
  palm: (c) => '<path d="M0 0 C1 -8 1 -14 -1 -22" stroke="#8a6a3a" stroke-width="2.2" fill="none"/><path d="M-1 -22 c-8 -3 -13 1 -15 5 c5 -4 10 -4 15 -5 c-5 -6 -11 -6 -14 -4 c6 0 10 2 14 4 c1 -7 7 -10 12 -9 c-5 2 -9 5 -12 9 c7 -3 12 0 14 4 c-5 -3 -10 -3 -14 -4z" fill="' + c.leaf + '"/>',
  dune: (c) => '<path d="M-16 0 Q-6 -9 4 -3 Q10 -8 18 0 Z" fill="' + c.dune + '"/>',
  wave: (c) => '<path d="M-14 0 q3.5 -4 7 0 t7 0 t7 0 t7 0" stroke="' + c.wave + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  boat: (c) => '<path d="M-10 0 h20 l-4 5 h-12z" fill="' + c.boat + '"/><path d="M0 0 v-14 l9 11 h-9" fill="' + c.sail + '"/>',
  pine: (c) => '<path d="M0 -24 l8 12 h-4 l6 9 h-20 l6 -9 h-4z" fill="' + c.pine + '"/><rect x="-1.5" y="-3" width="3" height="4" fill="#6b4b2a"/>',
  mount: (c) => '<path d="M-18 0 L-4 -20 L4 -9 L8 -14 L20 0 Z" fill="' + c.mount + '"/><path d="M-4 -20 L-8 -14 L-5 -15 L-2 -12 L1 -15 Z" fill="#fff" opacity=".85"/>',
  lake: (c) => '<ellipse rx="14" ry="6" fill="' + c.lake + '"/>'
};

export function renderMap(p, progress, W, opts = {}) {
  const narrow = W < 560;
  const cols = W >= 1000 ? 4 : W >= 700 ? 3 : 2;
  const n = p.stops.length;
  const rows = Math.ceil(n / cols);
  const mx = narrow ? 58 : 96, top = narrow ? 126 : 140, rh = narrow ? 168 : 186;
  const R = rng(p.id);
  const pts = p.stops.map((s, i) => {
    const row = Math.floor(i / cols); let c = i % cols; if (row % 2) c = cols - 1 - c;
    const x = mx + (cols === 1 ? 0 : c * (W - 2 * mx) / (cols - 1)) + (R() - 0.5) * (narrow ? 10 : 22);
    const y = top + row * rh + (R() - 0.5) * 22;
    return [x, y];
  });
  const rtl = lang() === 'ar';                       // Arabic: the road starts top-right, like the text
  const start = [pts[0][0] - (narrow ? 8 : 20), top - (narrow ? 84 : 92)];
  const last = pts[n - 1];
  const finish = [last[0] + ((rows % 2) ? 1 : -1) * (narrow ? 0 : 30), last[1] + (narrow ? 118 : 124)];
  if (rtl) { for (const q of [start, finish, ...pts]) q[0] = W - q[0]; }
  const H = Math.ceil(finish[1] + (narrow ? 78 : 86));
  const all = [start, ...pts, finish];
  const segs = segments(all);
  const doneIdx = p.stops.map((s, i) => (progress[s.id] ? i : -1)).filter((i) => i >= 0);
  const reach = doneIdx.length ? Math.max(...doneIdx) : -1;             // furthest stop reached
  const current = opts.currentId ? p.stops.findIndex((s) => s.id === opts.currentId) : -1;

  // Zones: Tunisia (top), sea (middle), Canada (bottom). Boundaries follow the route.
  const seaTop = top + rh * Math.max(0.55, Math.min(rows - 1.5, rows * 0.32));
  const seaBot = top + rh * Math.max(1.4, rows - 1.35);
  const col = { leaf: 'var(--map-leaf)', dune: 'var(--map-dune)', wave: 'var(--map-wave)', boat: 'var(--map-boat)', sail: 'var(--map-sail)', pine: 'var(--map-pine)', mount: 'var(--map-mount)', lake: 'var(--map-lake)' };

  // Keep decorations away from the road and the labels
  const road = segs.flatMap((s) => sample(s, 14));
  const blocked = (x, y) => road.some(([a, b]) => (a - x) ** 2 + (b - y) ** 2 < 46 * 46) ||
    pts.some(([a, b]) => Math.abs(a - x) < (narrow ? 78 : 92) && y > b - 34 && y < b + 72) ||
    (Math.abs(start[0] - x) < 90 && Math.abs(start[1] - y) < 50) || (Math.abs(finish[0] - x) < 110 && Math.abs(finish[1] - y) < 60);
  let decor = '';
  const step = narrow ? 44 : 52;
  for (let y = 26; y < H - 18; y += step) {
    for (let x = 18; x < W - 14; x += step) {
      const jx = x + (R() - 0.5) * step * 0.7, jy = y + (R() - 0.5) * step * 0.7;
      if (R() > 0.34 || blocked(jx, jy)) continue;
      let kind;
      if (jy < seaTop - 18) kind = R() < 0.55 ? 'palm' : 'dune';
      else if (jy < seaBot) kind = R() < 0.9 ? 'wave' : 'boat';
      else kind = R() < 0.6 ? 'pine' : R() < 0.7 ? 'mount' : 'lake';
      const sc = (narrow ? 0.8 : 1) * (0.85 + R() * 0.35);
      decor += '<g transform="translate(' + f(jx) + ' ' + f(jy) + ') scale(' + f(sc) + ')" opacity=".9">' + DECOR[kind](col) + '</g>';
    }
  }

  const coast = (y, wob) => { let d = 'M0 ' + f(y); for (let x = 0; x <= W; x += 40) d += ' L' + x + ' ' + f(y + Math.sin(x / 57 + wob) * 9 + Math.sin(x / 23) * 4); return d; };
  // Zone names in capitals, except Arabic (no case; letter-spacing would also break the joined letters)
  const zone = (s) => (lang() === 'ar' ? s : s.toUpperCase());
  const zst = lang() === 'ar' ? ' style="letter-spacing:0"' : '';
  const bg =
    '<rect width="' + W + '" height="' + H + '" fill="var(--map-sea)"/>' +
    '<path d="' + coast(seaTop, 1) + ' L' + W + ' 0 L0 0 Z" fill="var(--map-sand)"/>' +
    '<path d="' + coast(seaBot, 4) + ' L' + W + ' ' + H + ' L0 ' + H + ' Z" fill="var(--map-land)"/>' +
    '<text x="' + (rtl ? 14 : W - 14) + '" y="26" text-anchor="' + (rtl ? 'start' : 'end') + '" class="mzone"' + zst + '>' + esc(zone(t('Tunisia'))) + '</text>' +
    '<text x="' + (rtl ? 14 : W - 14) + '" y="' + f((seaTop + seaBot) / 2) + '" text-anchor="' + (rtl ? 'start' : 'end') + '" class="mzone"' + zst + '>' + esc(zone(t('Atlantic'))) + '</text>' +
    '<text x="' + (rtl ? 14 : W - 14) + '" y="' + f(seaBot + 30) + '" text-anchor="' + (rtl ? 'start' : 'end') + '" class="mzone"' + zst + '>' + esc(zone(t('Canada'))) + '</text>';

  const fullD = segD(segs);
  const doneD = reach >= 0 ? segD(segs.slice(0, reach + 1)) : '';
  const roadSvg =
    '<path d="' + fullD + '" class="mroad-edge"/>' +
    '<path d="' + fullD + '" class="mroad"/>' +
    (doneD ? '<path d="' + doneD + '" class="mroad-done" style="stroke:' + p.color + '"/>' : '') +
    '<path d="' + fullD + '" class="mroad-dash"/>';

  const maxc = narrow ? 15 : 19;
  // Shift a centred label sideways so it never runs off the map edge.
  const nudge = (x, lines, mc, k = 4.2) => { const half = Math.max(...lines.map((l) => l.length), mc * 0.7) * k + 6; return x - half < 4 ? 4 + half - x : x + half > W - 4 ? W - 4 - half - x : 0; };
  const pins = p.stops.map((s, i) => {
    const [x, y] = pts[i]; const done = !!progress[s.id]; const cur = i === current;
    const r = narrow ? 17 : 20;
    const lines = wrap(s.title, maxc);
    return '<g class="mpin' + (done ? ' done' : '') + (cur ? ' cur' : '') + (s.optional ? ' opt' : '') + '" data-sa="open-stop" data-stop="' + s.id + '" tabindex="0" role="button" aria-label="' + esc(t('Stop {n}: {title}', { n: i + 1, title: s.title }) + (done ? ' ' + t('(done)') : '')) + '" transform="translate(' + f(x) + ' ' + f(y) + ')">' +
      (cur ? '<circle r="' + r + '" class="mpulse" style="fill:' + p.color + '"><animate attributeName="r" from="' + r + '" to="' + (r + 16) + '" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" from=".45" to="0" dur="1.8s" repeatCount="indefinite"/></circle>' : '') +
      '<ellipse cy="' + (r - 1) + '" rx="' + (r * 0.8) + '" ry="4" class="mshadow"/>' +
      '<circle r="' + r + '" class="mdisc" style="' + (done ? 'fill:' + p.color + ';stroke:' + p.color : 'stroke:' + p.color) + '"/>' +
      '<text class="mnum" dy="5">' + (done ? '✓' : i + 1) + '</text>' +
      '<g transform="translate(' + f(nudge(x, [...lines, String(s.time).split(/[,(]/)[0].slice(0, maxc + 6)], maxc)) + ' 0)"><text class="mlabel" y="' + (r + 18) + '">' + lines.map((l, k) => '<tspan x="0" dy="' + (k ? 15 : 0) + '">' + esc(l) + '</tspan>').join('') + '</text>' +
      '<text class="mtime" y="' + (r + 20 + lines.length * 15) + '">' + esc(String(s.time).split(/[,(]/)[0].slice(0, maxc + 6)) + '</text></g>' +
      (cur ? '<g transform="translate(0 ' + (-r - 22) + ')"><rect x="-44" y="-13" width="88" height="22" rx="11" style="fill:' + p.color + '"/><text class="mhere" dy="3">' + esc(opts.hereLabel || t('You are here')) + '</text></g>' : '') +
      '</g>';
  }).join('');

  const startSvg = '<g transform="translate(' + f(start[0]) + ' ' + f(start[1]) + ')" class="mend"><circle r="' + (narrow ? 16 : 18) + '" class="mstart"/><path d="M-3 -8 v16 M-3 -8 h10 l-3 4 l3 4 h-10" class="mflag" style="stroke:var(--map-tn)"/><text x="' + (rtl ? -1 : 1) * (narrow ? 24 : 28) + '" dy="5" class="mendlabel" style="text-anchor:' + (rtl ? 'end' : 'start') + '">' + esc(opts.startLabel || t('Start: Tunisia')) + '</text></g>';
  const leaf = 'M0 -13 l3 6 l4 -2 l-1 6 l5 -1 l-3 4 l3 1 l-8 5 l1 3 h-2 v4 h-1 v-4 h-2 l1 -3 l-8 -5 l3 -1 l-3 -4 l5 1 l-1 -6 l4 2 z';
  const prLabel = t('Permanent resident');
  const finishSvg = '<g transform="translate(' + f(finish[0]) + ' ' + f(finish[1]) + ')" class="mend"><circle r="' + (narrow ? 24 : 28) + '" class="mfinish" style="stroke:' + p.color + '"/><path d="' + leaf + '" fill="#D52B1E" transform="scale(' + (narrow ? 1.05 : 1.2) + ')"/><text x="' + f(nudge(finish[0], [prLabel], 0, 5)) + '" y="' + (narrow ? 44 : 50) + '" class="mendlabel">' + esc(prLabel) + '</text></g>';

  const compass = narrow ? '' : '<g transform="translate(' + (rtl ? 46 : W - 46) + ' ' + (H - 50) + ')" class="mcompass"><circle r="22"/><path d="M0 -18 L5 0 L0 18 L-5 0 Z"/><path d="M0 -18 L5 0 L-5 0 Z" class="mcompass-n"/><text y="-25">N</text></g>';

  return '<svg class="jmap" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" style="direction:ltr" aria-label="' + esc(t('Map of the {name} path, {n} stops', { name: p.name, n })) + '">' + bg + decor + roadSvg + startSvg + finishSvg + pins + compass + '</svg>';
}

// Small trail thumbnail for path cards
export function miniTrail(p, done, W = 260, H = 54) {
  const n = p.stops.length; const R = rng(p.id + 'm');
  const rtl = lang() === 'ar';
  const pts = p.stops.map((s, i) => { const x = 12 + i * (W - 24) / (n - 1); return [rtl ? W - x : x, H / 2 + Math.sin(i * 1.3 + R() * 2) * (H / 2 - 12)]; });
  const d = segD(segments(pts));
  const dd = done ? segD(segments(pts).slice(0, Math.max(0, done - 1))) : '';
  return '<svg class="mtrail" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="direction:ltr" aria-hidden="true"><path d="' + d + '" class="mt-road"/>' + (dd ? '<path d="' + dd + '" style="stroke:' + p.color + '" class="mt-done"/>' : '') +
    pts.map((q, i) => '<circle cx="' + f(q[0]) + '" cy="' + f(q[1]) + '" r="' + (i === n - 1 ? 5 : 3.6) + '" style="' + (i < done ? 'fill:' + p.color + ';stroke:' + p.color : 'stroke:' + p.color) + '" class="mt-dot"/>').join('') + '</svg>';
}
