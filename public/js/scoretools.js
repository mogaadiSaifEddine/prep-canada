// Score calculator, latest invitation rounds and per-path estimates (HTML builders, no state).
import { hue } from './palette.js';
import { crs, fsw, boosts, poolAbove, EDU, IELTS_CLB, TEF_NCLC } from './crs.js';
import { t, tk, fmtDay, fmtNum } from './i18n.js';

const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SK = ['L', 'R', 'W', 'S'];
const SKN = { L: tk('Listening'), R: tk('Reading'), W: tk('Writing'), S: tk('Speaking') };
const PSKN = { L: tk('Partner listening'), R: tk('Partner reading'), W: tk('Partner writing'), S: tk('Partner speaking') };
const SHORT = { day: 'numeric', month: 'short' };
const BACK = '<span class="arr-back" aria-hidden="true"></span>';
const FWD = '<span class="arr-fwd" aria-hidden="true"></span>';
const tl = (opts) => opts.map(([v, l]) => [v, t(l)]); // translate the labels of a tk() option table

export const CAT_LABEL = {
  french: tk('French-language'), cec: tk('Canadian Experience Class'), pnp: tk('Provincial nominees'), health: tk('Healthcare & social services'), trades: tk('Trades'), transport: tk('Transport'), stem: tk('STEM'), education: tk('Education'), agri: tk('Agriculture'), physicians: tk('Physicians (Cdn exp.)'), senior: tk('Senior managers (Cdn exp.)'), military: tk('Military recruits'), fsw: tk('Federal Skilled Worker'), general: tk('General'), other: tk('Other')
};
const CAT_HEX = { french: '#1F4FA8', cec: '#1D7650', pnp: '#8A5A00', health: '#9D174D', trades: '#B45309', transport: '#155E75', stem: '#6A4BC4', education: '#4D7C0F', agri: '#65731B', physicians: '#9D174D', senior: '#475569', military: '#475569', fsw: '#B4263A', general: '#B4263A', other: '#475569' };
export const CAT_COLOR = Object.fromEntries(Object.entries(CAT_HEX).map(([k, c]) => [k, hue(c)]));
// Occupation categories a candidate can pick (all others need Canadian experience)
export const OCC = [['', tk('None of these / not sure')], ['health', tk('Healthcare & social services')], ['trades', tk('Trades')], ['transport', tk('Transport')], ['stem', tk('STEM')], ['education', tk('Education')], ['agri', tk('Agriculture & agri-food')]];

/* ---------- profile ---------- */
export function defaultProfile(levels) {
  const p = { age: 30, spouse: 'single', edu: 'mast', caEdu: '0', en: { L: 0, R: 0, W: 0, S: 0 }, fr: { L: 0, R: 0, W: 0, S: 0 }, fwExp: 3, caExp: 0, cert: false, pnp: false, sibling: false, offer: false, relative: false, spStudyCa: false, occ: '', kids: 0, sp: { edu: 'bach', lang: { L: 0, R: 0, W: 0, S: 0 }, caExp: 0 } };
  return fillFromTests(p, levels);
}
export function fillFromTests(p, levels) {
  if (!levels) return p;
  if (levels.enDetail) p.en = { ...levels.enDetail };
  if (levels.frDetail) p.fr = { ...levels.frDetail };
  return p;
}
export function readForm(form, prev) {
  const v = (n) => { const el = form.elements[n]; return el ? el.value : undefined; };
  const c = (n) => { const el = form.elements[n]; return !!(el && el.checked); };
  const lang = (pre) => { const o = {}; SK.forEach((k) => { o[k] = Number(v(pre + k)) || 0; }); return o; };
  return {
    ...prev,
    age: Math.max(16, Math.min(70, Number(v('age')) || 30)), spouse: v('spouse') || 'single', edu: v('edu'), caEdu: v('caEdu') || '0',
    en: lang('en'), fr: lang('fr'), fwExp: Number(v('fwExp')) || 0, caExp: Number(v('caExp')) || 0,
    cert: c('cert'), pnp: c('pnp'), sibling: c('sibling'), offer: c('offer'), relative: c('relative'), spStudyCa: c('spStudyCa'),
    occ: v('occ') || '', kids: Number(v('kids')) || 0,
    sp: { edu: v('spEdu') || 'bach', lang: lang('sp'), caExp: Number(v('spCaExp')) || 0 }
  };
}

/* ---------- draws helpers ---------- */
export function recent(draws, cat, months = 6) {
  if (!draws || !draws.ee) return null;
  const all = draws.ee.rounds.filter((r) => r.cat === cat);
  if (!all.length) return null;
  const since = new Date(all[0].date); since.setMonth(since.getMonth() - months);
  const rs = all.filter((r) => new Date(r.date) >= since);
  const scores = rs.map((r) => r.crs);
  return { last: all[0], rounds: rs, min: Math.min(...scores), max: Math.max(...scores), itas: rs.reduce((s, r) => s + r.itas, 0), count: rs.length };
}
function verdict(score, rec) {
  if (!rec) return null;
  if (score >= rec.max) return { cls: 'good', text: t('Above every cut-off in the last 6 months') };
  if (score >= rec.last.crs) return { cls: 'good', text: t('Above the latest cut-off') };
  if (score >= rec.min) return { cls: 'warn', text: t('Within the recent range: some rounds would have invited you') };
  return { cls: 'bad', text: t('{n} points below the lowest recent cut-off', { n: rec.min - score }) };
}
const allAtLeast = (o, n) => !!o && SK.every((k) => (Number(o[k]) || 0) >= n);

/* ---------- calculator ---------- */
const clbOpts = (table, k, sel, unit, scoreFmt) => {
  const rows = [[0, t('None')]];
  for (let n = 10; n >= 4; n--) { const row = table[k].find((x) => x[1] === n); rows.push([n, unit + ' ' + n + (n === 10 ? '+' : '') + (row ? ' (' + scoreFmt(row[0]) + ')' : '')]); }
  rows.push([3, t('{unit} 3 or less', { unit })]);
  return rows.map(([n, l]) => '<option value="' + n + '"' + (Number(sel) === n ? ' selected' : '') + '>' + h(l) + '</option>').join('');
};
const sel = (name, opts, cur, attrs = '') => '<select name="' + name + '" id="c-' + name + '"' + attrs + '>' + opts.map(([v, l]) => '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + h(l) + '</option>').join('') + '</select>';
const field = (label, input, hint) => '<label class="cfield"><span class="clabel">' + h(label) + '</span>' + input + (hint ? '<span class="chint">' + hint + '</span>' : '') + '</label>';
const check = (name, label, on, hint) => '<label class="ccheck"><input type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + '><span><b>' + h(label) + '</b>' + (hint ? '<br><span class="chint">' + h(hint) + '</span>' : '') + '</span></label>';

export function calculatorHtml(p, { levels, draws, signedIn, saved }) {
  const langBlock = (pre, title, table, unit, fmt, cur) => '<fieldset class="cset"><legend>' + title + '</legend><div class="cgrid4">' + SK.map((k) => field(t(SKN[k]), '<select name="' + pre + k + '" id="c-' + pre + k + '">' + clbOpts(table, k, cur[k], unit, fmt) + '</select>')).join('') + '</div></fieldset>';
  const hasTests = levels && (levels.enDetail || levels.frDetail);
  const years = (max) => Array.from({ length: max + 1 }, (_, i) => [i, i === 0 ? t('None or less than 1 year') : i === max ? t('{n}+ years', { n: i }) : i === 1 ? t('1 year') : t('{n} years', { n: i })]);
  const form = '<form id="f-crs" class="stack cform" autocomplete="off">' +
    (hasTests ? '<div class="banner-info small">' + t('Your language levels were filled in from your latest IELTS / TEF results in the app.') + ' <button type="button" class="btn sm" data-sa="crs-fill">' + t('Refill from my tests') + '</button></div>' : '') +
    '<fieldset class="cset"><legend>' + t('You') + '</legend><div class="cgrid">' +
      field(t('Age'), '<input type="number" name="age" id="c-age" min="16" max="70" inputmode="numeric" value="' + h(p.age) + '">', t('Your age when you would receive the invitation.')) +
      field(t('Marital status'), sel('spouse', [['single', t('Single, or partner not coming / Canadian')], ['with', t('Married or common-law, partner coming with me')]], p.spouse)) +
      field(t('Children coming with you'), sel('kids', [0, 1, 2, 3, 4].map((n) => [n, n === 4 ? '4+' : String(n)]), p.kids), t('Only used for the fees and proof of funds.')) +
    '</div></fieldset>' +
    '<fieldset class="cset"><legend>' + t('Education') + '</legend><div class="cgrid">' +
      field(t('Highest diploma (with an ECA)'), sel('edu', tl(EDU), p.edu)) +
      field(t('Studies in Canada'), sel('caEdu', [['0', t('None')], ['1', t('1–2 year Canadian credential')], ['3', t('3+ year Canadian credential')]], p.caEdu)) +
    '</div></fieldset>' +
    langBlock('en', t('English (IELTS band)'), IELTS_CLB, 'CLB', (x) => x.toFixed(1), p.en) +
    langBlock('fr', t('French (TEF score)'), TEF_NCLC, 'NCLC', (x) => x + '+', p.fr) +
    '<fieldset class="cset"><legend>' + t('Skilled work (TEER 0–3)') + '</legend><div class="cgrid">' +
      field(t('Outside Canada, last 10 years'), sel('fwExp', years(6), p.fwExp)) +
      field(t('In Canada, last 10 years'), sel('caExp', years(5), p.caExp)) +
      field(t('Your occupation group'), sel('occ', tl(OCC), p.occ), t('For the category draws. Check the eligible NOC codes on the official page.')) +
    '</div>' + check('cert', t('Certificate of qualification from a Canadian province (trades)'), p.cert) + '</fieldset>' +
    '<fieldset class="cset" id="c-partner"' + (p.spouse === 'with' ? '' : ' hidden') + '><legend>' + t('Your partner') + '</legend><div class="cgrid">' +
      field(t('Partner\'s highest diploma'), sel('spEdu', tl(EDU), p.sp.edu)) +
      field(t('Partner\'s work in Canada'), sel('spCaExp', years(5), p.sp.caExp)) +
    '</div><div class="cgrid4">' + SK.map((k) => field(t(PSKN[k]), '<select name="sp' + k + '" id="c-sp' + k + '">' + clbOpts(IELTS_CLB, k, p.sp.lang[k], 'CLB', (x) => x.toFixed(1)) + '</select>')).join('') + '</div>' +
      check('spStudyCa', t('Partner studied 2+ years in Canada'), p.spStudyCa, t('FSW adaptability points only.')) + '</fieldset>' +
    '<fieldset class="cset"><legend>' + t('Extras') + '</legend>' +
      check('pnp', t('Provincial nomination'), p.pnp, t('+600 CRS points.')) +
      check('sibling', t('Brother or sister in Canada (citizen or PR, 18+)'), p.sibling, t('+15 CRS points.')) +
      check('offer', t('Valid job offer (arranged employment)'), p.offer, t('No CRS points since March 2025, but still 10 + 5 points on the FSW grid.')) +
      check('relative', t('Close relative in Canada (citizen or PR)'), p.relative, t('FSW adaptability points only.')) +
    '</fieldset>' +
    '<p class="small muted">' + (signedIn ? t('Changes are saved to your account.') : t('Saved on this device as you type. {link} to keep it on all your devices.', { link: '<a href="#/signup">' + t('Create a free account') + '</a>' })) + '</p>' +
    '</form>';
  return '<div><a class="btn sm ghost" href="#/paths">' + BACK + t('All paths') + '</a></div>' +
    '<div><p class="eyebrow">' + t('Express Entry') + '</p><h1>' + t('Score calculator') + '</h1><p class="muted" style="max-width:70ch">' + t('Your Comprehensive Ranking System (CRS) score out of 1,200 and your Federal Skilled Worker grid out of 100, compared with the latest invitation rounds. Official grids in force on 27 September 2026.') + '</p></div>' +
    '<div class="calc">' + form + '<aside class="calc-out" id="crs-out" aria-live="polite">' + resultHtml(p, draws) + '</aside></div>' +
    '<button type="button" class="crs-float" data-sa="to-result"><span class="small">' + t('Your CRS') + '</span><b class="mono" id="crs-float-n">' + crs(p).total + '</b><span class="small">' + t('Details') + ' ↓</span></button>';
}

export function resultHtml(p, draws) {
  const r = crs(p); const f = fsw(p);
  const pool = poolAbove(draws && draws.ee && draws.ee.dist, r.total);
  const row = (label, v, max) => '<div class="crow"><span>' + h(label) + '</span><span class="mono">' + v + (max ? '<span class="muted"> / ' + max + '</span>' : '') + '</span></div>';
  const cmp = [];
  const addCmp = (cat, label, ok, why, bonus = 0) => {
    const rec = recent(draws, cat); if (!rec) return;
    const score = r.total + bonus;
    const v = ok ? verdict(score, rec) : { cls: '', text: why };
    cmp.push('<div class="ccmp"><div class="row between" style="gap:6px"><b class="small">' + h(label) + '</b><span class="mono small">' + t('last {score} · {date}', { score: rec.last.crs, date: fmtDay(rec.last.date, SHORT) }) + '</span></div>' +
      '<div class="row small" style="gap:6px"><span class="muted">' + t('6-month range {min}–{max}', { min: rec.min, max: rec.max }) + '</span>' + (v ? '<span class="pill ' + v.cls + '">' + h(v.text) + '</span>' : '') + '</div></div>');
  };
  const frOk = allAtLeast(p.fr, 7);
  const expOk = (Number(p.fwExp) || 0) + (Number(p.caExp) || 0) >= 1;
  addCmp('french', t('French-language draws'), frOk && expOk, !frOk ? t('Needs NCLC 7 in all four French skills') : t('Needs 1 year of skilled work'));
  addCmp('cec', t('Canadian Experience Class'), (Number(p.caExp) || 0) >= 1, t('Needs 1 year of skilled work in Canada'));
  if (p.occ) addCmp(p.occ, t('{category} draws', { category: t(CAT_LABEL[p.occ] || p.occ) }), expOk, t('Needs 6 months of work in an eligible occupation'));
  if (!p.pnp) addCmp('pnp', t('With a provincial nomination (+600)'), true, '', 600); else addCmp('pnp', t('Provincial nominee draws'), true, '');
  const bs = boosts(p).slice(0, 4);
  return '<div class="panel cres"><p class="eyebrow">' + t('Your CRS score') + '</p><div class="crsbig mono">' + r.total + '<span class="muted"> / ' + fmtNum(1200) + '</span></div>' +
    (pool ? '<p class="small muted">' + t('About {above} of {total} candidates in the pool ({pct}%) had a higher score on {date}.', { above: '<b>' + fmtNum(pool.above) + '</b>', total: fmtNum(pool.total), pct: pool.pct, date: fmtDay(pool.asOf) }) + '</p>' : '') +
    '<div class="cbreak">' + row(t('Core: age, education, language, Canadian work'), r.coreTotal, p.spouse === 'with' ? 460 : 500) + (p.spouse === 'with' ? row(t('Partner'), r.spTotal, 40) : '') + row(t('Skill transferability'), r.transferTotal, 100) + row(t('Additional: nomination, French, Canadian studies, sibling'), r.addTotal, 600) + '</div>' +
    '<details class="small"><summary>' + t('Details') + '</summary><div class="cbreak" style="margin-top:6px">' + row(t('Age'), r.core.age) + row(t('Education'), r.core.edu) + row(t('First language ({lang})', { lang: r.firstName === 'French' ? t('French') : t('English') }), r.core.lang1) + row(t('Second language'), r.core.lang2) + row(t('Canadian work'), r.core.caExp) + row(t('Transferability: education'), r.transfer.education) + row(t('Transferability: foreign work'), r.transfer.foreign) + row(t('Trade certificate'), r.transfer.cert) + row(t('French bonus'), r.additional.french) + row(t('Canadian studies'), r.additional.caEdu) + row(t('Sibling'), r.additional.sibling) + row(t('Nomination'), r.additional.pnp) + '</div></details>' +
    '<div class="fswline"><span><b>' + t('FSW grid') + '</b> <span class="mono">' + f.total + ' / 100</span></span>' + (f.pass && f.eligible ? '<span class="pill good">' + t('Passes 67') + '</span>' : !f.eligible ? '<span class="pill warn">' + t('Needs CLB 7 in all four + 1 year work') + '</span>' : '<span class="pill bad">' + t('Below 67') + '</span>') + '</div>' +
    '</div>' +
    (cmp.length ? '<div class="panel"><h3>' + t('Against the latest rounds') + '</h3>' + cmp.join('') + '<a class="small" href="#/paths/draws">' + t('All invitation rounds') + FWD + '</a></div>' : '') +
    (bs.length ? '<div class="panel"><h3>' + t('What would raise your score') + '</h3><ul class="boosts">' + bs.map((b) => '<li><span class="mono gain">+' + b.gain + '</span><span><b>' + h(t(b.label)) + '</b> ' + FWD + ' ' + b.total + (b.how ? '<br><span class="small muted">' + h(t(b.how)) + '</span>' : '') + '</span></li>').join('') + '</ul></div>' : '') +
    '<p class="small muted">' + t('An estimate for planning, not an official result. Confirm with {link}.', { link: '<a href="https://ircc.canada.ca/english/immigrate/skilled/crs-tool.asp" target="_blank" rel="noopener">' + t('IRCC\'s own tool') + '</a>' }) + '</p>';
}

/* ---------- trend chart: lowest CRS per round for one category ---------- */
export function trendChart(rounds, { color = 'var(--hue-blue)', you = null, title = '', width = 640 } = {}) {
  const rs = rounds.slice().reverse(); if (rs.length < 2) return '';
  const W = Math.max(300, Math.min(760, width)), H = W < 500 ? 200 : 230, pl = 44, pr = 16, pt = 18, pb = 30;
  const vals = rs.map((r) => r.crs).concat(you != null ? [you] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = Math.max(8, (hi - lo) * 0.12); lo = Math.floor((lo - pad) / 10) * 10; hi = Math.ceil((hi + pad) / 10) * 10;
  const t0 = new Date(rs[0].date).getTime(), t1 = new Date(rs[rs.length - 1].date).getTime();
  const x = (d) => pl + (W - pl - pr) * ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0));
  const y = (v) => pt + (H - pt - pb) * (1 - (v - lo) / Math.max(1, hi - lo));
  const step = (hi - lo) > 120 ? 50 : (hi - lo) > 50 ? 20 : 10;
  let grid = '';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" class="tgrid"/><text x="' + (pl - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" class="tax" text-anchor="end">' + v + '</text>';
  // month ticks
  const m = new Date(rs[0].date); m.setUTCDate(1); m.setUTCMonth(m.getUTCMonth() + 1);
  let ticks = '';
  while (m.getTime() <= t1) { const xx = x(m.toISOString().slice(0, 10)); ticks += '<text x="' + xx.toFixed(1) + '" y="' + (H - 8) + '" class="tax" text-anchor="middle">' + fmtDay(m, { month: 'short' }) + '</text>'; m.setUTCMonth(m.getUTCMonth() + 1); }
  const d = rs.map((r, i) => (i ? 'L' : 'M') + x(r.date).toFixed(1) + ' ' + y(r.crs).toFixed(1)).join(' ');
  const youLine = you != null ? '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(you).toFixed(1) + '" y2="' + y(you).toFixed(1) + '" class="tyou"/><text x="' + (pl + 6) + '" y="' + (y(you) - 6).toFixed(1) + '" class="tyoul" text-anchor="start">' + t('You: {score}', { score: you }) + '</text>' : '';
  const pts = rs.map((r) => { const cx = x(r.date), cy = y(r.crs); const tx = Math.min(W - pr - 70, Math.max(pl + 70, cx)); const above = cy > pt + 44; return '<g class="tpt" tabindex="0" role="img" aria-label="' + h(t('{date}: lowest score {score}, {n} invitations', { date: fmtDay(r.date), score: r.crs, n: fmtNum(r.itas) })) + '"><circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="14" class="thit"/><circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4.5" class="tdot" style="fill:' + color + '"/><g class="ttip"><rect x="' + (tx - 68) + '" y="' + (above ? cy - 50 : cy + 12) + '" width="136" height="38" rx="6"/><text x="' + tx + '" y="' + (above ? cy - 34 : cy + 28) + '" text-anchor="middle" class="ttip1">' + r.crs + ' · ' + fmtDay(r.date, SHORT) + '</text><text x="' + tx + '" y="' + (above ? cy - 19 : cy + 43) + '" text-anchor="middle" class="ttip2">' + t('{n} invitations', { n: fmtNum(r.itas) }) + '</text></g></g>'; }).join('');
  const last = rs[rs.length - 1];
  const lastLabel = '<text x="' + (x(last.date) - 8).toFixed(1) + '" y="' + (y(last.crs) - 10).toFixed(1) + '" text-anchor="end" class="tlast">' + last.crs + '</text>';
  return '<figure class="trend"><svg viewBox="0 0 ' + W + ' ' + H + '" style="direction:ltr" role="group" aria-label="' + h(title || t('Lowest score per round')) + '">' + grid + ticks + youLine + '<path d="' + d + '" class="tline" style="stroke:' + color + '"/>' + lastLabel + pts + '</svg></figure>';
}

/* ---------- draws page ---------- */
export function drawsHtml(draws, { cat = 'french', group = 'ee', you = null, width = 640 }) {
  const W = width;
  if (!draws) return '<div class="panel"><p>' + t('Could not load the invitation rounds. Check your connection and try again.') + '</p></div>';
  const tabs = [['ee', tk('Express Entry')], ['quebec', tk('Québec (Arrima)')], ['provinces', tk('Provinces')]];
  const head = '<div><a class="btn sm ghost" href="#/paths">' + BACK + t('All paths') + '</a></div><div><p class="eyebrow">' + t('Invitation rounds') + '</p><h1>' + t('Latest draws and lowest scores') + '</h1><p class="muted" style="max-width:70ch">' + t('Who was invited, how many, and the lowest score that got an invitation.') + ' ' +
    (draws.live ? '<span class="pill good">' + t('Live from IRCC') + '</span> ' + t('Express Entry updated {date}.', { date: fmtDay(draws.ee.rounds[0].date) }) : t('Express Entry as of {date}.', { date: fmtDay(draws.ee.rounds[0].date) })) + ' ' + t('Québec and provinces checked {date}.', { date: fmtDay(draws.checked) }) + '</p></div>' +
    '<div class="seg" role="tablist">' + tabs.map(([k, l]) => '<button type="button" role="tab" data-sa="draws-group" data-g="' + k + '" aria-pressed="' + (group === k) + '">' + t(l) + '</button>').join('') + '</div>';
  let body = '';
  if (group === 'ee') {
    const cats = [...new Set(draws.ee.rounds.map((r) => r.cat))];
    const order = ['french', 'cec', 'pnp', 'health', 'trades', 'transport', 'stem', 'education', 'agri', 'senior', 'physicians', 'military', 'fsw', 'general', 'other'].filter((c) => cats.includes(c));
    const c = order.includes(cat) ? cat : order[0];
    const rs = draws.ee.rounds.filter((r) => r.cat === c);
    const rec = recent(draws, c);
    const catName = (k) => (CAT_LABEL[k] ? t(CAT_LABEL[k]) : k);
    body = '<div class="row chips" role="group" aria-label="' + t('Category') + '">' + order.map((k) => '<button type="button" class="fchip' + (k === c ? ' on' : '') + '" data-sa="draws-cat" data-c="' + k + '" aria-pressed="' + (k === c) + '"><i style="background:' + (CAT_COLOR[k] || 'var(--hue-slate)') + '"></i>' + h(catName(k)) + '</button>').join('') + '</div>' +
      '<div class="panel"><div class="row between"><div><h2>' + h(catName(c)) + '</h2><p class="small muted">' + t('Lowest CRS score invited, each round') + (rec ? ' · ' + t('last 6 months: {rounds} rounds, {n} invitations', { rounds: rec.count, n: fmtNum(rec.itas) }) : '') + '</p></div>' +
      (rec ? '<div class="kstat"><span class="eyebrow">' + t('Latest') + '</span><b class="mono">' + rec.last.crs + '</b><span class="small muted">' + fmtDay(rec.last.date) + '</span></div>' : '') + '</div>' +
      trendChart(rs.slice(0, W < 500 ? 14 : 24), { width: W, color: CAT_COLOR[c], you, title: t('Lowest score per {category} round', { category: catName(c) }) }) +
      (you != null ? '<p class="small">' + (c === 'pnp' ? t('Dashed line: your score from the {link} (a nomination adds 600).', { link: '<a href="#/paths/score">' + t('calculator') + '</a>' }) : t('Dashed line: your score from the {link}.', { link: '<a href="#/paths/score">' + t('calculator') + '</a>' })) + '</p>' : '<p class="small">' + t('{link} to see it on the chart.', { link: '<a href="#/paths/score">' + t('Calculate your score') + '</a>' }) + '</p>') +
      '<div class="tablewrap"><table class="dtable"><thead><tr><th>' + t('Date') + '</th><th>' + t('Round') + '</th><th class="num">' + t('Invitations') + '</th><th class="num">' + t('Lowest score') + '</th>' + (you != null ? '<th>' + t('You') + '</th>' : '') + '</tr></thead><tbody>' +
      rs.slice(0, 16).map((r) => '<tr><td>' + fmtDay(r.date) + '</td><td class="mono">#' + r.n + '</td><td class="num mono">' + fmtNum(r.itas) + '</td><td class="num mono"><b>' + r.crs + '</b></td>' + (you != null ? '<td>' + ((c === 'pnp' ? you + 600 : you) >= r.crs ? '<span class="pill good">' + t('Above') + '</span>' : '<span class="pill">' + t('{n} short', { n: r.crs - (c === 'pnp' ? you + 600 : you) }) + '</span>') + '</td>' : '') + '</tr>').join('') +
      '</tbody></table></div>' + (draws.ee.note ? '<p class="small muted">' + h(t(draws.ee.note)) + '</p>' : '') + '<p class="small"><a href="' + draws.ee.source + '" target="_blank" rel="noopener">' + t('IRCC: all rounds of invitations') + ' ↗</a></p></div>' +
      latestAll(draws);
  } else if (group === 'quebec') {
    const qd = draws.quebec;
    body = '<div class="panel"><h2>' + t('Québec skilled workers (PSTQ)') + '</h2><p class="small muted">' + h(t(qd.note)) + '</p>' +
      '<div class="tablewrap"><table class="dtable"><thead><tr><th>' + t('Date') + '</th><th>' + t('Stream') + '</th><th>' + t('Group') + '</th><th class="num">' + t('Invitations') + '</th><th class="num">' + t('Lowest score') + '</th></tr></thead><tbody>' +
      qd.rounds.map((r) => r.groups.map((g, i) => '<tr' + (i ? ' class="sub"' : '') + '><td>' + (i ? '' : fmtDay(r.date)) + '</td><td>' + (i ? '' : h(t('Stream {n}', { n: r.stream }))) + '</td><td>' + h(t(g[0])) + '</td><td class="num mono">' + (g[1] != null ? fmtNum(g[1]) : '—') + '</td><td class="num mono"><b>' + (g[2] != null ? g[2] : '—') + '</b></td></tr>').join('')).join('') +
      '</tbody></table></div><p class="small">' + t('Stream 1 needs French NCLC 7 oral and 5 written; stream 2 needs NCLC 5 oral.') + ' <a href="' + qd.source + '" target="_blank" rel="noopener">' + t('Québec: invitations in Arrima') + ' ↗</a></p></div>';
  } else {
    const pd = draws.provinces;
    body = '<div class="panel"><h2>' + t('Provincial rounds') + '</h2><p class="small muted">' + h(t(pd.note)) + '</p>' +
      '<div class="tablewrap"><table class="dtable"><thead><tr><th>' + t('Date') + '</th><th>' + t('Province') + '</th><th>' + t('Stream') + '</th><th class="num">' + t('Invitations') + '</th><th class="num">' + t('Lowest score') + '</th></tr></thead><tbody>' +
      pd.rounds.map((r) => '<tr><td>' + fmtDay(r.date) + '</td><td><b>' + h(r.prov) + '</b></td><td>' + h(t(r.stream)) + (r.fr ? ' <span class="pill accent">' + t('Francophone') + '</span>' : '') + '</td><td class="num mono">' + (r.itas != null ? fmtNum(r.itas) : '—') + '</td><td class="num mono">' + (r.min != null ? '<b>' + r.min + '</b>' : '<span class="muted">' + t('not published') + '</span>') + '</td></tr>').join('') +
      '</tbody></table></div>' + (pd.news && pd.news.length ? '<ul class="small" style="margin:0;padding-inline-start:18px;display:flex;flex-direction:column;gap:6px">' + pd.news.map((n) => '<li>' + h(t(n)) + '</li>').join('') + '</ul>' : '') +
      '<p class="small">' + t('Express Entry rounds for provincial nominees are under {where}.', { where: t('Express Entry') + ' ' + FWD + ' ' + t('Provincial nominees') }) + '</p></div>';
  }
  return head + body + '<p class="small muted" style="max-width:80ch">' + t('Past cut-offs do not guarantee future ones: each round\'s minimum depends on how many people IRCC invites and who is in the pool that day.') + '</p>';
}
function latestAll(draws) {
  const rs = draws.ee.rounds.slice(0, 10);
  return '<div class="panel"><h3>' + t('Last 10 Express Entry rounds, all categories') + '</h3><div class="tablewrap"><table class="dtable"><thead><tr><th>' + t('Date') + '</th><th>' + t('Category') + '</th><th class="num">' + t('Invitations') + '</th><th class="num">' + t('Lowest score') + '</th></tr></thead><tbody>' +
    rs.map((r) => '<tr><td>' + fmtDay(r.date) + '</td><td><span class="cdot" style="background:' + (CAT_COLOR[r.cat] || 'var(--hue-slate)') + '"></span>' + h(CAT_LABEL[r.cat] ? t(CAT_LABEL[r.cat]) : r.name) + '</td><td class="num mono">' + fmtNum(r.itas) + '</td><td class="num mono"><b>' + r.crs + '</b></td></tr>').join('') + '</tbody></table></div></div>';
}

/* ---------- per-path estimate ---------- */
const FUNDS = { 1: 15263, 2: 19001, 3: 23360, 4: 28362 };
const PATH_DRAWS = { 'ee-french': 'french', 'ee-cec': 'cec', pnp: 'pnp' };
const NO_DRAWS = {
  c16: tk('No invitation rounds: once you have a job offer, you apply for the work permit directly.'),
  fcip: tk('No invitation rounds: you apply after an employer job offer and a community recommendation.'),
  aip: tk('No federal rounds: an Atlantic employer and the province endorse you. New Brunswick also runs AIP rounds (see Provinces).'),
  fmcsp: tk('No rounds: applications are processed in order until 2,970 study permits or 25 August 2027.'),
  study: tk('No rounds: you need admission, then a study permit.'),
  spouse: tk('No rounds: sponsorship applications are processed in order.')
};

export function lastCutLine(p, draws) {
  const cat = PATH_DRAWS[p.id];
  if (cat) { const rec = recent(draws, cat); return rec ? t('Last cut-off {score} · {date}', { score: rec.last.crs, date: fmtDay(rec.last.date, SHORT) }) : ''; }
  if (p.id === 'quebec' && draws && draws.quebec && draws.quebec.rounds[0]) { const r = draws.quebec.rounds[0]; return t('Last Arrima round {date}, min {score}', { date: fmtDay(r.date, SHORT), score: Math.min(...r.groups.map((g) => g[2]).filter((x) => x != null)) }); }
  if (p.id === 'ee-fsw') return t('No general draw since April 2024');
  return '';
}

export function estimate(p, prof, draws, levels) {
  const out = { status: 'info', title: '', lines: [], score: null };
  const lv = levels || {};
  const fr = prof ? prof.fr : lv.frDetail; const en = prof ? prof.en : lv.enDetail;
  const exp = prof ? (Number(prof.fwExp) || 0) + (Number(prof.caExp) || 0) : null;
  const r = prof ? crs(prof) : null;
  const cat = PATH_DRAWS[p.id];
  if (r) out.score = r.total;
  const need = (ok, text) => { if (!ok) out.lines.push(text); return ok; };
  if (p.id === 'ee-french' || p.id === 'ee-cec' || (p.id === 'ee-fsw' && prof)) {
    if (!prof) { out.status = 'info'; out.title = t('Calculate your score to see your chances here.'); return out; }
    let ok = true;
    if (p.id === 'ee-french') { ok = need(allAtLeast(fr, 7), t('Needs NCLC 7 in all four French skills')) && ok; ok = need(exp >= 1, t('Needs 1 year of skilled work')) && ok; }
    if (p.id === 'ee-cec') ok = need((Number(prof.caExp) || 0) >= 1, t('Needs 1 year of skilled work in Canada')) && ok;
    if (p.id === 'ee-fsw') { const f = fsw(prof); ok = need(f.eligible, t('Needs CLB 7 in all four skills, 1 year of work and a post-secondary diploma')) && ok; ok = need(f.pass, t('FSW grid {score}/100: needs 67', { score: f.total })) && ok; }
    const c = p.id === 'ee-fsw' ? (allAtLeast(fr, 7) ? 'french' : prof.occ || null) : cat;
    const rec = c ? recent(draws, c) : null;
    if (!ok) { out.status = 'blocked'; out.title = t('Not eligible yet'); }
    else if (!rec) { out.status = 'far'; out.title = t('Eligible, but no general draws since April 2024'); out.lines.push(t('Pick your occupation group in the calculator, or add French NCLC 7, to compare with category rounds.')); }
    else { const v = verdict(r.total, rec); out.status = v.cls === 'good' ? 'good' : v.cls === 'warn' ? 'close' : 'far'; out.title = v.text; out.lines.push(t('Your CRS {score} vs {category} rounds: last {last} ({date}), range {min}–{max} in 6 months.', { score: r.total, category: CAT_LABEL[c] ? t(CAT_LABEL[c]) : c, last: rec.last.crs, date: fmtDay(rec.last.date, SHORT), min: rec.min, max: rec.max })); }
    const b = boosts(prof).find((x) => !/nomination/.test(x.label));
    if (b && (out.status === 'close' || out.status === 'far')) out.lines.push(t('Biggest gain: {label} (+{gain}).', { label: t(b.label), gain: b.gain }));
  } else if (p.id === 'pnp') {
    const rec = recent(draws, 'pnp');
    out.status = 'info'; out.title = t('Depends on getting a nomination');
    if (r && rec) { const base = prof.pnp ? r.total - 600 : r.total; const vars = { base, total: base + 600, min: rec.min, max: rec.max }; out.lines.push(base + 600 >= rec.max ? t('With a nomination: {base} + 600 = {total}, above every PNP cut-off range ({min}–{max}).', vars) : t('With a nomination: {base} + 600 = {total}, compared with the PNP cut-off range ({min}–{max}).', vars)); }
    out.lines.push(t('Ontario closed its French stream on 30 May 2026; New Brunswick and Manitoba still run francophone rounds.'));
  } else if (p.id === 'ee-fsw') {
    out.title = t('Calculate your score to see your chances here.');
  } else if (p.id === 'quebec') {
    const oral = fr && Math.min(fr.L || 0, fr.S || 0), wr = fr && (fr.W || 0);
    if (fr && oral >= 7 && wr >= 5) { out.status = 'close'; out.title = t('French level fits stream 1'); }
    else if (fr && oral >= 5) { out.status = 'close'; out.title = t('French level fits stream 2 (TEER 3–5)'); out.lines.push(t('Stream 1 needs NCLC 7 oral and 5 written.')); }
    else { out.status = 'blocked'; out.title = t('Needs NCLC 7 oral (stream 1) or 5 (stream 2)'); }
    const q = draws && draws.quebec && draws.quebec.rounds[0];
    if (q) out.lines.push(t('Latest round {date}: minimum Arrima scores {scores} (Québec\'s own scale).', { date: fmtDay(q.date, SHORT), scores: q.groups.map((g) => g[2]).filter((x) => x != null).join(', ') }));
  } else if (['c16', 'fcip', 'fmcsp'].includes(p.id)) {
    const okFr = p.id === 'c16' ? fr && Math.min(fr.L || 0, fr.S || 0) >= 5 : allAtLeast(fr, 5);
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

export function costFor(p, prof) {
  const adults = 1 + (prof && prof.spouse === 'with' ? 1 : 0);
  const kids = prof ? Number(prof.kids) || 0 : 0;
  const people = adults + kids;
  const bio = people > 1 ? 170 : 85;
  if (p.id === 'spouse') return { items: [[tk('Sponsorship + processing + right of PR'), 1255], [tk('Biometrics'), 85]], total: 1340, funds: null, people };
  if (['study', 'fmcsp'].includes(p.id)) return null;
  const items = [[tk('PR processing, CAD 990 per adult'), 990 * adults], [tk('Right of PR fee, CAD 600 per adult'), 600 * adults]];
  if (kids) items.push([tk('Children, about CAD 270 each'), 270 * kids]);
  items.push([tk('Biometrics'), bio]);
  if (p.id.startsWith('ee') || p.id === 'pnp') items.push([tk('Diploma assessment (ECA), about'), 260]);
  items.push([tk('Language test(s), about'), p.id === 'ee-french' && prof && allAtLeast(prof.en, 5) ? 600 : 300]);
  const total = items.reduce((s, x) => s + x[1], 0);
  const needFunds = ['ee-french', 'ee-fsw', 'pnp', 'fcip', 'aip'].includes(p.id);
  return { items, total, funds: needFunds ? (FUNDS[people] || null) : null, people };
}

export function estimateHtml(p, prof, draws, levels, signedIn) {
  const e = estimate(p, prof, draws, levels);
  const icon = { good: '●', close: '◐', far: '○', blocked: '✗', info: 'ℹ' }[e.status];
  const cls = { good: 'good', close: 'warn', far: 'bad', blocked: 'bad', info: '' }[e.status];
  const many = e.cost && e.cost.people > 1;
  const cost = e.cost ? '<div class="est-cost"><b class="small">' + (many ? t('Official fees for {n} people', { n: e.cost.people }) : t('Official fees for 1 person')) + '</b><div class="cbreak">' + e.cost.items.map(([l, v]) => '<div class="crow small"><span>' + h(t(l)) + '</span><span class="mono">' + fmtNum(v) + '</span></div>').join('') + '<div class="crow"><b>' + t('Total, about') + '</b><b class="mono">CAD ' + fmtNum(e.cost.total) + '</b></div></div>' + (e.cost.funds ? '<p class="small muted">' + (many ? t('Plus proof of funds: CAD {amount} for {n} people (not spent, but it must be in your account).', { amount: fmtNum(e.cost.funds), n: e.cost.people }) : t('Plus proof of funds: CAD {amount} for 1 person (not spent, but it must be in your account).', { amount: fmtNum(e.cost.funds) })) + '</p>' : '') + '</div>' : '';
  const cut = draws ? lastCutLine(p, draws) : '';
  return '<div class="panel estimate" id="estimate"><div class="row between"><h3>' + t('Your estimate') + '</h3>' + (e.score != null ? '<a class="pill ink" href="#/paths/score">' + t('CRS {score} · edit', { score: e.score }) + '</a>' : '<a class="btn sm" href="#/paths/score">' + t('Calculate my score') + '</a>') + '</div>' +
    (e.title ? '<p class="est-title"><span class="pill ' + cls + '">' + icon + '</span> <b>' + h(e.title) + '</b></p>' : '') +
    (e.lines.length ? '<ul class="small est-lines">' + e.lines.map((l) => '<li>' + h(l) + '</li>').join('') + '</ul>' : '') +
    '<div class="est-grid"><div><b class="small">' + t('Timeline') + '</b><p class="small">' + (prof && p.lang && p.lang.exam === 'tef' && !allAtLeast(prof.fr, p.lang.min) ? t('{time}, plus 2–6 months to reach NCLC {n}', { time: h(p.time), n: p.lang.min }) : h(p.time)) + '</p>' + (cut ? '<p class="small"><b>' + t('Latest invitations:') + '</b> ' + h(cut) + ' · <a href="#/paths/draws' + (PATH_DRAWS[p.id] ? '?c=' + PATH_DRAWS[p.id] : p.id === 'quebec' ? '?g=quebec' : '') + '">' + t('see rounds') + '</a></p>' : '') + '</div>' + cost + '</div>' +
    (prof && !signedIn ? '<p class="small muted">' + t('Saved on this device. {link} to keep it.', { link: '<a href="#/signup">' + t('Create an account') + '</a>' }) + '</p>' : '') + '</div>';
}
