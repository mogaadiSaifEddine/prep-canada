// Immigration path maps: list, finder and one map per path. Progress is saved to the account.
import { PATHS, PAUSED, CHECKED, LINKS } from './paths.js';
import { renderMap, miniTrail } from './pathmap.js';
import { calculatorHtml, resultHtml, readForm, defaultProfile, fillFromTests, drawsHtml, estimateHtml, estimate, lastCutLine, recent } from './scoretools.js';
import { crs } from './crs.js';

const LS = 'pc_profile';
const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch { /* private mode */ } };

const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Official score → CLB/NCLC tables (same as the coaches)
const IELTS_CLB = { L: [[8.5, 10], [8, 9], [7.5, 8], [6, 7], [5.5, 6], [5, 5], [4.5, 4]], R: [[8, 10], [7, 9], [6.5, 8], [6, 7], [5, 6], [4, 5], [3.5, 4]], W: [[7.5, 10], [7, 9], [6.5, 8], [6, 7], [5.5, 6], [5, 5], [4, 4]], S: [[7.5, 10], [7, 9], [6.5, 8], [6, 7], [5.5, 6], [5, 5], [4, 4]] };
const TEF_NCLC = { L: [[546, 10], [503, 9], [462, 8], [434, 7], [393, 6], [352, 5], [306, 4]], R: [[546, 10], [503, 9], [462, 8], [434, 7], [393, 6], [352, 5], [306, 4]], W: [[558, 10], [512, 9], [472, 8], [428, 7], [379, 6], [330, 5], [268, 4]], S: [[556, 10], [518, 9], [494, 8], [456, 7], [422, 6], [387, 5], [328, 4]] };
const lvl = (t, k, v) => { if (v == null) return null; for (const [m, n] of t[k]) if (v >= m) return n; return 3; };

export function createPaths(ctx) {
  const st = { journey: null, levels: null, finder: null, loaded: false, view: 'map', openStop: null, pathId: null, draws: null, drawsAt: 0, drawsCat: 'french', drawsGroup: 'ee' };

  async function loadDraws() {
    if (st.draws && Date.now() - st.drawsAt < 10 * 60 * 1000) return st.draws;
    try { const r = await fetch('/api/draws', { credentials: 'same-origin' }); if (r.ok) { st.draws = await r.json(); st.drawsAt = Date.now(); } } catch { /* offline: keep what we have */ }
    return st.draws;
  }
  // The score profile: saved in the account, or on this device for visitors
  const profile = () => (ctx.me() ? journey().profile : lsGet()) || null;
  function setProfile(p) { if (ctx.me()) { journey().profile = p; save(); } else lsSet(p); }
  function load() {
    if (!ctx.me()) return Promise.resolve();
    if (!st.loading) st.loading = doLoad().catch((e) => { st.loading = null; throw e; });
    return st.loading;
  }
  async function doLoad() {
    st.loaded = true;
    const [j, ie, te] = await Promise.all([
      ctx.getDoc('journey', 'progress').catch(() => null),
      ctx.getDoc('ielts', 'profile').catch(() => null),
      ctx.getDoc('tef', 'profile').catch(() => null)
    ]);
    st.journey = j || { progress: {}, pinned: null, finder: null };
    st.finder = st.journey.finder || null;
    const lv = { en: null, fr: null, enDetail: null, frDetail: null };
    if (ie && ie.bands && ['L', 'R', 'W', 'S'].every((k) => ie.bands[k] != null)) { const d = {}; ['L', 'R', 'W', 'S'].forEach((k) => { d[k] = lvl(IELTS_CLB, k, ie.bands[k]); }); lv.en = Math.min(...Object.values(d)); lv.enDetail = d; }
    if (te && te.scores && ['L', 'R', 'W', 'S'].every((k) => te.scores[k] != null)) { const d = {}; ['L', 'R', 'W', 'S'].forEach((k) => { d[k] = lvl(TEF_NCLC, k, te.scores[k]); }); lv.fr = Math.min(...Object.values(d)); lv.frDetail = d; }
    st.levels = lv;
    // First time signed in: bring over a profile made as a visitor
    if (!st.journey.profile) { const v = lsGet(); if (v) { st.journey.profile = v; save(); } }
  }
  const journey = () => st.journey || (st.journey = { progress: {}, pinned: null, finder: null });
  let saveT = null;
  function save() {
    if (!ctx.me()) return;
    clearTimeout(saveT);
    saveT = setTimeout(() => ctx.putDoc('journey', 'progress', journey()).catch(() => ctx.toast('Your progress could not be saved. Check your connection.')), 600);
  }
  const doneCount = (p) => p.stops.filter((s) => (journey().progress[p.id] || {})[s.id]).length;
  const nextStop = (p) => { const pr = journey().progress[p.id] || {}; return p.stops.find((s) => !s.optional && !pr[s.id]) || p.stops.find((s) => !pr[s.id]); };

  /* ---------- finder ---------- */
  const Q = [
    ['where', 'Where are you now?', [['abroad', 'Outside Canada'], ['canada', 'In Canada (outside Québec) with a permit'], ['quebec', 'In Québec with a permit']]],
    ['fr', 'Your French level', [['0', 'None or basic'], ['5', 'NCLC 5–6'], ['7', 'NCLC 7+']]],
    ['en', 'Your English level', [['0', 'None or basic'], ['5', 'CLB 5–6'], ['7', 'CLB 7–8'], ['9', 'CLB 9+']]],
    ['exp', 'Skilled work experience (TEER 0–3)', [['0', 'Less than 1 year'], ['1', '1–2 years'], ['3', '3+ years']]],
    ['cexp', '12+ months of skilled work in Canada?', [['no', 'No'], ['yes', 'Yes']]],
    ['offer', 'Job offer from a Canadian employer?', [['no', 'No'], ['yes', 'Yes']]],
    ['partner', 'Partner who is a Canadian citizen or PR?', [['no', 'No'], ['yes', 'Yes']]],
    ['study', 'Open to studying in Canada first?', [['no', 'No'], ['yes', 'Yes']]]
  ];
  function defaults() {
    const f = { where: 'abroad', fr: '0', en: '0', exp: '1', cexp: 'no', offer: 'no', partner: 'no', study: 'no' };
    const lv = st.levels || {};
    if (lv.fr != null) f.fr = lv.fr >= 7 ? '7' : lv.fr >= 5 ? '5' : '0';
    if (lv.en != null) f.en = lv.en >= 9 ? '9' : lv.en >= 7 ? '7' : lv.en >= 5 ? '5' : '0';
    return f;
  }
  function rank(f) {
    const fr = Number(f.fr), en = Number(f.en), exp = Number(f.exp);
    const inCa = f.where !== 'abroad';
    const out = [];
    const add = (id, score, why) => out.push({ id, score, why });
    if (f.partner === 'yes') add('spouse', 95, 'Your partner can sponsor you directly.');
    add('ee-french', fr >= 7 && exp >= 1 ? 90 : fr >= 5 && exp >= 1 ? 55 : 10, fr >= 7 && exp >= 1 ? 'NCLC 7 + skilled experience: the biggest 2026 draws, cut-offs around 380–420.' : fr >= 5 ? 'Reach NCLC 7 in all four skills to enter the French draws.' : 'Needs NCLC 7 in French.');
    add('ee-cec', f.cexp === 'yes' && f.where !== 'quebec' ? 88 : inCa ? 45 : 8, f.cexp === 'yes' ? 'You already have Canadian experience.' : 'Needs 12 months of skilled work in Canada.');
    add('c16', !inCa && fr >= 5 ? 75 : fr >= 5 ? 40 : 12, fr >= 5 ? 'NCLC 5 oral is enough for a no-LMIA work permit outside Québec.' : 'Needs NCLC 5 in speaking and listening.');
    add('quebec', f.where === 'quebec' && fr >= 5 ? 85 : fr >= 7 ? 45 : 10, f.where === 'quebec' ? 'Québec invites mostly people already living there (PSTQ, and PEQ reopened in 2026).' : 'Strong French helps; 2026 invitations favour people in Québec.');
    add('fcip', f.offer === 'yes' && fr >= 5 ? 80 : fr >= 5 ? 45 : 10, 'Needs a job offer from a designated employer in one of 6 francophone communities.');
    add('pnp', f.offer === 'yes' || inCa ? 70 : 35, f.offer === 'yes' || inCa ? 'Provinces favour people with a local job or experience; +600 CRS.' : 'Few streams accept people abroad without a job offer (e.g. Saskatchewan priority sectors).');
    add('aip', f.offer === 'yes' ? 65 : 25, 'Needs a job offer from a designated employer in the Atlantic provinces.');
    add('ee-fsw', en >= 9 && exp >= 3 ? 50 : en >= 7 && exp >= 1 ? 30 : 8, en >= 7 ? 'Eligible with CLB 7, but 2026 invitations go to categories and nominees: add French or a category occupation.' : 'Needs CLB 7 in English.');
    add('fmcsp', f.study === 'yes' && fr >= 5 ? 82 : f.study === 'yes' ? 35 : 15, 'Study in French outside Québec, then direct PR. Tunisia is eligible until August 2027.');
    add('study', f.study === 'yes' ? 50 : 10, 'The longest route: study, work permit, then PR.');
    return out.sort((a, b) => b.score - a.score);
  }
  const matchPill = (sc) => (sc >= 75 ? '<span class="pill good">Strong match</span>' : sc >= 40 ? '<span class="pill warn">Possible</span>' : '<span class="pill">Unlikely now</span>');

  /* ---------- views ---------- */
  function langLine(p) {
    if (!p.lang) return '';
    const lv = st.levels || {};
    const mine = p.lang.exam === 'tef' ? lv.fr : lv.en;
    const unit = p.lang.exam === 'tef' ? 'NCLC' : 'CLB';
    let you = '';
    if (mine != null) you = mine >= p.lang.min ? ' <span class="pill good">You: ' + unit + ' ' + mine + '</span>' : ' <span class="pill warn">You: ' + unit + ' ' + mine + ', need ' + p.lang.min + '</span>';
    return '<span>' + h(p.lang.label) + '</span>' + you;
  }

  function list() {
    const me = ctx.me(); const f = st.finder;
    const ranked = f ? rank(f) : null;
    const order = ranked ? ranked.map((r) => PATHS.find((p) => p.id === r.id)).filter(Boolean) : PATHS;
    const why = (id) => ranked && ranked.find((r) => r.id === id);
    const pinned = journey().pinned && PATHS.find((p) => p.id === journey().pinned);
    const cards = order.map((p) => {
      const d = doneCount(p); const r = why(p.id);
      return '<a class="panel pathcard" href="#/paths/' + p.id + '" style="--pc:' + p.color + '"><div class="row between"><span class="tag">' + h(p.tag) + '</span>' + (r ? matchPill(r.score) : '') + '</div><h3>' + h(p.name) + '</h3><p class="small muted">' + h(p.summary) + '</p>' +
        (r ? '<p class="small"><b>For you:</b> ' + h(r.why) + '</p>' : '') +
        miniTrail(p, d) +
        '<div class="row small muted" style="gap:14px"><span>' + p.stops.length + ' stops</span><span>' + h(p.time) + '</span>' + (d ? '<span><b>' + d + '/' + p.stops.length + ' done</b></span>' : '') + '</div>' +
        (cutLine(p) ? '<div class="cutline small"><span class="mono">' + h(cutLine(p)) + '</span>' + estPill(p) + '</div>' : estPill(p) ? '<div class="cutline small">' + estPill(p) + '</div>' : '') + '</a>';
    }).join('');
    return '<div><p class="eyebrow">Immigration paths</p><h1>Your road to Canada</h1><p class="muted" style="max-width:66ch">Every route to permanent residence as a map of stops: what to do, which documents, how long, what it costs, with tips for applicants from Tunisia. Checked against official sources on ' + CHECKED + '.</p></div>' +
      (pinned ? '<a class="panel pinned" href="#/paths/' + pinned.id + '" style="--pc:' + pinned.color + '"><p class="eyebrow">Your path</p><h2>' + h(pinned.name) + '</h2><p>' + doneCount(pinned) + ' of ' + pinned.stops.length + ' stops done' + (nextStop(pinned) ? ' · next: <b>' + h(nextStop(pinned).title) + '</b>' : ' · all done') + '</p></a>' : '') +
      toolsHtml() +
      finderHtml() +
      '<div class="pathgrid">' + cards + '</div>' +
      '<div class="panel flat"><h3>Paused programs</h3><ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">' + PAUSED.map((x) => '<li><b>' + h(x.name) + '.</b> ' + h(x.note) + ' <a href="' + x.link + '" target="_blank" rel="noopener">Official page</a></li>').join('') + '</ul></div>' +
      disclaimer() + (me ? '' : '<p class="small muted"><a href="#/signup">Create a free account</a> to save your progress on each map.</p>');
  }
  const cutLine = (p) => (st.draws ? lastCutLine(p, st.draws) : '');
  function estPill(p) {
    const pr = profile(); if (!pr && !(st.levels && (st.levels.frDetail || st.levels.enDetail))) return '';
    const e = estimate(p, pr, st.draws, st.levels);
    const map = { good: ['good', 'Likely'], close: ['warn', 'Possible'], far: ['bad', 'Hard now'], blocked: ['', 'Not eligible yet'] };
    const m = map[e.status]; return m ? '<span class="pill ' + m[0] + '">' + m[1] + '</span>' : '';
  }
  function toolsHtml() {
    const pr = profile(); const score = pr ? crs(pr).total : null;
    const fr = st.draws ? recent(st.draws, 'french') : null; const cec = st.draws ? recent(st.draws, 'cec') : null;
    return '<div class="tools">' +
      '<a class="panel tool" href="#/paths/score"><span class="tool-ic" aria-hidden="true">' + (score != null ? '<b class="mono">' + score + '</b>' : '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h4"/></svg>') + '</span><span><b>' + (score != null ? 'Your CRS score' : 'Score calculator') + '</b><br><span class="small muted">' + (score != null ? 'Edit your profile, see what raises it' : 'CRS out of 1,200 and the FSW 67 grid, in 2 minutes') + '</span></span></a>' +
      '<a class="panel tool" href="#/paths/draws"><span class="tool-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 20h18M5 16l4-5 4 3 6-8"/></svg></span><span><b>Latest draws</b><br><span class="small muted">' + (fr && cec ? 'French ' + fr.last.crs + ' · CEC ' + cec.last.crs + ' · lowest scores per round' : 'Lowest score invited, per round and path') + '</span></span></a>' +
      '</div>';
  }
  function finderHtml() {
    const f = st.finder || defaults();
    const open = st.finderOpen || !st.finder;
    return '<details class="panel" id="finder"' + (open ? ' open' : '') + '><summary><b>Find my path</b> <span class="small muted">· 8 quick questions' + (st.levels && (st.levels.fr != null || st.levels.en != null) ? ', with your language levels from the app' : '') + '</span></summary>' +
      '<form id="f-finder" class="stack" style="margin-top:12px">' + Q.map(([k, label, opts]) => '<div class="stack" style="gap:6px"><span class="small muted">' + h(label) + '</span><div class="opts">' + opts.map(([v, l]) => '<label class="opt"><input type="radio" name="fq-' + k + '" value="' + v + '"' + (f[k] === v ? ' checked' : '') + '><span>' + h(l) + '</span></label>').join('') + '</div></div>').join('') +
      '<div class="row"><button class="btn primary" type="submit">Show my best paths</button>' + (st.finder ? '<button class="btn" type="button" data-sa="finder-clear">Clear</button>' : '') + '</div></form></details>';
  }
  function disclaimer() {
    return '<p class="small muted" style="max-width:80ch">This is general information, not legal advice. Programs, cut-offs and fees change often: always confirm on the official page linked at each stop before you act. If you hire help, use a licensed consultant (check the <a href="' + LINKS.cicc + '" target="_blank" rel="noopener">CICC public register</a>) or a lawyer, and never pay anyone who promises a guaranteed visa or job.</p>';
  }

  function stopHtml(p, s, i, inDrawer) {
    const prog = journey().progress[p.id] || {};
    const done = !!prog[s.id]; const lv = st.levels || {};
    let appLine = '';
    if (s.app) {
      const mine = s.app.exam === 'tef' ? lv.fr : lv.en; const unit = s.app.exam === 'tef' ? 'NCLC' : 'CLB';
      appLine = '<div class="row small"><a class="btn sm dark" href="' + s.app.go + '">' + h(s.app.label) + '</a>' + (mine != null ? '<span class="pill ' + (mine >= s.app.min ? 'good' : 'warn') + '">Your latest level: ' + unit + ' ' + mine + (mine >= s.app.min ? '' : ' (target ' + s.app.min + ')') + '</span>' : (ctx.me() ? '<span class="muted">Take the placement test to see your level here.</span>' : '')) + '</div>';
    }
    return (inDrawer ? '' : '') +
      '<div class="row" style="gap:8px"><span class="chip">⏱ ' + h(s.time) + '</span><span class="chip">' + h(s.cost) + '</span>' + (s.optional ? '<span class="chip">Optional</span>' : '') + '</div>' +
      (s.why ? '<p>' + h(s.why) + '</p>' : '') +
      (s.steps && s.steps.length ? '<ol class="steps">' + s.steps.map((x) => '<li>' + h(x) + '</li>').join('') + '</ol>' : '') +
      (s.docs && s.docs.length ? '<div class="row small" style="gap:6px"><span class="muted">Documents:</span>' + s.docs.map((x) => '<span class="pill">' + h(x) + '</span>').join('') + '</div>' : '') +
      (s.tunisia ? '<p class="tn small" style="--pc:' + p.color + '"><b>From Tunisia:</b> ' + h(s.tunisia) + '</p>' : '') +
      appLine +
      '<p class="small"><a href="' + s.link + '" target="_blank" rel="noopener">Official page ↗</a></p>';
  }

  function estHead(p) {
    const e = estimate(p, profile(), st.draws, st.levels); const cut = cutLine(p);
    if (!e.title && !cut) return '';
    const cls = { good: 'good', close: 'warn', far: 'bad', blocked: 'bad' }[e.status] || '';
    return '<button type="button" class="esthead" data-sa="to-estimate">' + (e.title ? '<span class="pill ' + cls + '">' + h(e.title) + '</span>' : '') + (cut ? '<span class="small mono">' + h(cut) + '</span>' : '') + '<span class="small">Your estimate ↓</span></button>';
  }
  function mapWidth() { const a = document.getElementById('app'); return Math.max(300, Math.min(1180, (a ? a.clientWidth : 360) - 32)); }

  function detail(id) {
    const p = PATHS.find((x) => x.id === id);
    if (!p) return '<div class="panel"><p>Path not found. <a href="#/paths">All paths</a></p></div>';
    st.pathId = id;
    const prog = journey().progress[p.id] || {};
    const d = doneCount(p); const nx = nextStop(p);
    const pct = Math.round(100 * d / p.stops.length);
    const isPinned = journey().pinned === p.id;
    const head = '<div class="row between"><a class="btn sm ghost" href="#/paths">← All paths</a><div class="seg" role="group" aria-label="View"><button type="button" data-sa="path-view" data-v="map" aria-pressed="' + (st.view === 'map') + '">Map</button><button type="button" data-sa="path-view" data-v="list" aria-pressed="' + (st.view === 'list') + '">List</button></div></div>' +
      '<div class="panel pathhead" style="--pc:' + p.color + '"><p class="eyebrow">' + h(p.tag) + '</p><h1>' + h(p.name) + '</h1><p class="muted" style="max-width:70ch">' + h(p.summary) + '</p>' +
      '<div class="row" style="gap:8px"><span class="chip">⏱ ' + h(p.time) + '</span><span class="chip">' + h(p.cost) + '</span>' + (p.lang ? '<span class="chip">' + langLine(p) + '</span>' : '') + '</div>' +
      '<div class="stack" style="gap:6px"><div class="row between small"><span><b>' + d + '</b> of ' + p.stops.length + ' stops done' + (nx ? ' · next: <b>' + h(nx.title) + '</b>' : ' · all done') + '</span><span class="mono">' + pct + '%</span></div><div class="meter"><i style="width:' + pct + '%;background:' + p.color + '"></i></div></div>' +
      estHead(p) +
      '<div class="row">' + (nx ? '<button class="btn primary" data-sa="open-stop" data-stop="' + nx.id + '" style="background:' + p.color + ';border-color:' + p.color + '">Open next stop</button>' : '') + (ctx.me() ? '<button class="btn" data-sa="pin-path" data-path="' + p.id + '">' + (isPinned ? 'My path ✓' : 'Make this my path') + '</button>' : '<a class="btn" href="#/signup">Sign up to save progress</a>') + '</div>' +
      '<details class="about"><summary>Who it\'s for and what\'s new in 2026</summary><div class="grid" style="margin-top:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))"><div><b class="small">Who it\'s for</b><ul class="small" style="margin:6px 0 0;padding-left:18px">' + p.who.map((x) => '<li>' + h(x) + '</li>').join('') + '</ul></div>' + (p.facts && p.facts.length ? '<div><b class="small">Good to know in 2026</b><ul class="small" style="margin:6px 0 0;padding-left:18px">' + p.facts.map((x) => '<li>' + h(x) + '</li>').join('') + '</ul></div>' : '') + '</div></details></div>';
    let body;
    if (st.view === 'map') {
      body = '<div class="mapwrap" id="mapwrap" style="--pc:' + p.color + '">' + renderMap(p, prog, mapWidth(), { currentId: nx && nx.id, hereLabel: d ? 'Next stop' : 'Start here' }) + '</div><p class="small muted">Tap a pin to see what to do at that stop and mark it done.</p>';
    } else {
      body = '<ol class="route" style="--pc:' + p.color + '">' + p.stops.map((s, i) => {
        const done = !!prog[s.id]; const current = nx && nx.id === s.id;
        return '<li class="stop' + (done ? ' done' : '') + (current ? ' current' : '') + (s.optional ? ' optional' : '') + '" id="stop-' + s.id + '"><button class="dot" data-sa="stop-toggle" data-path="' + p.id + '" data-stop="' + s.id + '" aria-pressed="' + done + '" aria-label="' + (done ? 'Mark not done: ' : 'Mark done: ') + h(s.title) + '">' + (done ? '✓' : (i + 1)) + '</button>' +
          '<details class="stopbody"' + (current ? ' open' : '') + '><summary><span class="stoptitle">' + h(s.title) + (current ? ' <span class="pill accentp">Next stop</span>' : '') + '</span></summary><div class="stack" style="gap:10px;margin-top:10px">' + stopHtml(p, s, i) +
          '<div class="row"><button class="btn sm' + (done ? '' : ' primary') + '" data-sa="stop-toggle" data-path="' + p.id + '" data-stop="' + s.id + '">' + (done ? 'Mark as not done' : 'Mark as done') + '</button></div></div></details></li>';
      }).join('') + '<li class="stop finish"><span class="dot">🍁</span><div class="stopbody"><span class="stoptitle">Permanent resident</span></div></li></ol>';
    }
    return head + body + estimateHtml(p, profile(), st.draws, st.levels, !!ctx.me()) + disclaimer();
  }

  /* ---------- calculator + draws pages ---------- */
  function scorePage() {
    let p = profile();
    if (!p) p = defaultProfile(st.levels);
    st.calc = p;
    return calculatorHtml(p, { levels: st.levels, draws: st.draws, signedIn: !!ctx.me(), saved: !!profile() });
  }
  function drawsPage() {
    const pr = profile();
    return drawsHtml(st.draws, { cat: st.drawsCat, group: st.drawsGroup, you: pr ? crs(pr).total : null, width: mapWidth() - 40 });
  }
  function onInput(form) {
    if (!form || form.id !== 'f-crs') return false;
    st.calc = readForm(form, st.calc || defaultProfile(st.levels));
    const sp = document.getElementById('c-partner'); if (sp) sp.hidden = st.calc.spouse !== 'with';
    const out = document.getElementById('crs-out'); if (out) out.innerHTML = resultHtml(st.calc, st.draws);
    const fl = document.getElementById('crs-float-n'); if (fl) fl.textContent = crs(st.calc).total;
    setProfile(st.calc); // account saves are debounced inside save()
    return true;
  }

  /* ---------- stop drawer (side panel on desktop, bottom sheet on phones) ---------- */
  function drawerEl() {
    let d = document.getElementById('stopdrawer');
    if (!d) { d = document.createElement('div'); d.id = 'stopdrawer'; document.body.appendChild(d); }
    return d;
  }
  function openStop(sid) {
    const p = PATHS.find((x) => x.id === st.pathId); if (!p) return;
    const i = p.stops.findIndex((s) => s.id === sid); if (i < 0) return;
    st.openStop = sid;
    const s = p.stops[i]; const done = !!(journey().progress[p.id] || {})[s.id];
    const d = drawerEl();
    d.innerHTML = '<div class="dr-backdrop" data-sa="close-stop"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-title" style="--pc:' + p.color + '">' +
      '<div class="dr-grip" aria-hidden="true"></div>' +
      '<div class="dr-head"><span class="dr-num' + (done ? ' done' : '') + '">' + (done ? '✓' : i + 1) + '</span><div style="min-width:0"><p class="eyebrow">Stop ' + (i + 1) + ' of ' + p.stops.length + '</p><h2 id="dr-title">' + h(s.title) + '</h2></div><button class="btn sm ghost dr-x" data-sa="close-stop" aria-label="Close">✕</button></div>' +
      '<div class="dr-body stack" style="gap:12px">' + stopHtml(p, s, i, true) + '</div>' +
      '<div class="dr-foot"><button class="btn" data-sa="open-stop" data-stop="' + (p.stops[i - 1] || s).id + '"' + (i ? '' : ' disabled') + ' aria-label="Previous stop">←</button>' +
      '<button class="btn ' + (done ? '' : 'primary') + ' grow" data-sa="stop-toggle" data-path="' + p.id + '" data-stop="' + s.id + '" style="' + (done ? '' : 'background:' + p.color + ';border-color:' + p.color) + '">' + (done ? 'Done ✓ · undo' : 'Mark as done') + '</button>' +
      '<button class="btn" data-sa="open-stop" data-stop="' + (p.stops[i + 1] || s).id + '"' + (i < p.stops.length - 1 ? '' : ' disabled') + ' aria-label="Next stop">→</button></div></aside>';
    requestAnimationFrame(() => d.classList.add('open'));
    const x = d.querySelector('.dr-x'); if (x) x.focus({ preventScroll: true });
  }
  function closeStop() { const d = document.getElementById('stopdrawer'); st.openStop = null; if (d) { d.classList.remove('open'); setTimeout(() => { if (!st.openStop) d.innerHTML = ''; }, 250); } }
  document.addEventListener('keydown', (e) => {
    if (!st.openStop) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('mpin')) { e.preventDefault(); openStop(e.target.dataset.stop); }
      return;
    }
    if (e.key === 'Escape') closeStop();
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const p = PATHS.find((x) => x.id === st.pathId); const i = p.stops.findIndex((s) => s.id === st.openStop);
      const j = i + (e.key === 'ArrowRight' ? 1 : -1); if (p.stops[j]) openStop(p.stops[j].id);
    }
  });
  let lastW = 0;
  window.addEventListener('resize', () => {
    clearTimeout(st.rz); st.rz = setTimeout(() => {
      const w = document.getElementById('mapwrap'); if (!w || !st.pathId) return;
      const W = mapWidth(); if (Math.abs(W - lastW) < 40) return; lastW = W;
      const p = PATHS.find((x) => x.id === st.pathId); const nx = nextStop(p);
      w.innerHTML = renderMap(p, journey().progress[p.id] || {}, W, { currentId: nx && nx.id, hereLabel: doneCount(p) ? 'Next stop' : 'Start here' });
    }, 150);
  });

  async function show(raw) {
    const [id0, qs] = String(raw || '').split('?'); const id = id0 || null;
    const params = new URLSearchParams(qs || '');
    const tok = st.tok = (st.tok || 0) + 1; // a newer navigation wins over a slower older one
    closeStop();
    if (id === 'score' || id === 'draws') {
      st.pathId = null;
      if (params.get('c')) { st.drawsCat = params.get('c'); st.drawsGroup = 'ee'; }
      if (params.get('g')) st.drawsGroup = params.get('g');
      ctx.render('paths', '<div class="row"><span class="spinner"></span></div>');
      await Promise.all([load(), loadDraws()]);
      if (tok !== st.tok) return;
      ctx.render('paths', id === 'score' ? scorePage() : drawsPage());
      return;
    }
    st.pathId = id;
    ctx.render('paths', '<div class="row"><span class="spinner"></span></div>');
    await Promise.all([load(), loadDraws()]);
    if (tok !== st.tok) return;
    ctx.render('paths', id ? detail(id) : list());
    lastW = mapWidth();
    if (id && st.view === 'map') return;
    if (id) { const nx = nextStop(PATHS.find((x) => x.id === id) || { stops: [] }); if (nx && journey().progress[id] && Object.keys(journey().progress[id]).length) setTimeout(() => { const el = document.getElementById('stop-' + nx.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); }
  }

  function onClick(t) {
    const a = t.dataset.sa;
    if (a === 'stop-toggle') {
      const pid = t.dataset.path, sid = t.dataset.stop;
      const pr = journey().progress[pid] || (journey().progress[pid] = {});
      if (pr[sid]) delete pr[sid]; else pr[sid] = new Date().toISOString().slice(0, 10);
      if (!journey().pinned) journey().pinned = pid;
      save();
      const y = window.scrollY; ctx.render('paths', detail(pid)); window.scrollTo(0, y);
      if (!ctx.me()) ctx.toast('Sign in to keep your progress.');
      if (st.openStop) {
        const p = PATHS.find((x) => x.id === pid); const i = p.stops.findIndex((x) => x.id === sid);
        if (pr[sid] && p.stops[i + 1]) { ctx.toast('Stop ' + (i + 1) + ' done.'); openStop(p.stops[i + 1].id); } else openStop(sid);
      } else { const el = document.getElementById('stop-' + sid); if (el) el.scrollIntoView({ block: 'nearest' }); }
      return true;
    }
    if (a === 'open-stop') { if (st.view === 'list') { const el = document.getElementById('stop-' + t.dataset.stop); if (el) { const dd = el.querySelector('details'); if (dd) dd.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } return true; } openStop(t.dataset.stop); return true; }
    if (a === 'close-stop') { closeStop(); return true; }
    if (a === 'path-view') { st.view = t.dataset.v; closeStop(); const y = window.scrollY; ctx.render('paths', detail(st.pathId)); window.scrollTo(0, y); return true; }
    if (a === 'pin-path') { journey().pinned = journey().pinned === t.dataset.path ? null : t.dataset.path; save(); const y = window.scrollY; ctx.render('paths', detail(t.dataset.path)); window.scrollTo(0, y); return true; }
    if (a === 'jump') { const el = document.getElementById('stop-' + t.dataset.stop); if (el) { const d = el.querySelector('details'); if (d) d.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } return true; }
    if (a === 'crs-fill') { const f = document.getElementById('f-crs'); st.calc = fillFromTests(st.calc || defaultProfile(st.levels), st.levels); setProfile(st.calc); ctx.render('paths', calculatorHtml(st.calc, { levels: st.levels, draws: st.draws, signedIn: !!ctx.me(), saved: true })); ctx.toast('Filled from your latest test results.'); return !!f; }
    if (a === 'draws-cat') { st.drawsCat = t.dataset.c; const y = window.scrollY; ctx.render('paths', drawsPage()); window.scrollTo(0, y); return true; }
    if (a === 'draws-group') { st.drawsGroup = t.dataset.g; const y = window.scrollY; ctx.render('paths', drawsPage()); window.scrollTo(0, y); return true; }
    if (a === 'to-result') { const el = document.getElementById('crs-out'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true; }
    if (a === 'to-estimate') { const el = document.getElementById('estimate'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true; }
    if (a === 'finder-clear') { st.finder = null; journey().finder = null; save(); ctx.render('paths', list()); return true; }
    return false;
  }
  function onSubmit(form) {
    if (form.id !== 'f-finder') return false;
    const f = {}; Q.forEach(([k]) => { const x = form.querySelector('input[name="fq-' + k + '"]:checked'); f[k] = x ? x.value : defaults()[k]; });
    st.finder = f; st.finderOpen = false; journey().finder = f; save();
    ctx.render('paths', list());
    const g = document.querySelector('.pathgrid'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }
  function pinnedSummary() {
    const j = st.journey; if (!j || !j.pinned) return null;
    const p = PATHS.find((x) => x.id === j.pinned); if (!p) return null;
    return { p, done: doneCount(p), next: nextStop(p) };
  }
  return { show, onClick, onSubmit, onInput, load, loadDraws, profile, score: () => { const p = profile(); return p ? crs(p).total : null; }, frenchCut: () => { const r = st.draws && recent(st.draws, 'french'); return r && r.last; }, cecCut: () => { const r = st.draws && recent(st.draws, 'cec'); return r && r.last; }, pinnedSummary, reset: () => { st.loaded = false; st.loading = null; st.journey = null; st.levels = null; st.finder = null; } };
}
