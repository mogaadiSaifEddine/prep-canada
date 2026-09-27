// Prep Canada app shell: accounts, routing, plans and payments, admin, and the services the coaches use.
import { createIELTS } from './ielts.js';
import { createTEF } from './tef.js';
import { createPaths } from './pathsview.js';
import { miniTrail } from './pathmap.js';

const $ = (s) => document.querySelector(s);
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
const fmtTND = (n) => Number(n).toLocaleString('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 3 }) + ' TND';

const APP = { me: null, ent: {}, config: null, coach: null, coachName: null, coaches: {}, billing: { period: 'month', plan: null, exam: 'ielts', method: null }, admin: {}, installEvt: null };

/* ---------------- basics ---------------- */
let toastT = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4200); }

async function api(method, path, body) {
  let r;
  try {
    r = await fetch(path, { method, credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-requested-with': 'prep-canada' }, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch { throw { code: 'offline', message: 'You seem to be offline. Check your connection and try again.' }; }
  let j = null; try { j = await r.json(); } catch { /* not JSON */ }
  if (!r.ok) throw Object.assign({ status: r.status }, (j && j.error) || { code: 'server_error', message: 'Something went wrong. Try again.' });
  return j;
}
const curExam = () => (location.hash.startsWith('#/tef') ? 'tef' : 'ielts');
const FR = {
  plan_required: 'Cette fonction fait partie des offres Solo et Duo.',
  rate_limited: 'Le service est occupé. Réessayez dans une minute.',
  ai_error: 'Le service IA a renvoyé une erreur. Réessayez.',
  ai_timeout: 'L’IA a mis trop de temps à répondre. Réessayez.',
  invalid_json: 'La réponse est arrivée dans un mauvais format. Réessayez.',
  offline: 'Vous semblez hors ligne. Vérifiez votre connexion.',
  unauthorized: 'Reconnectez-vous.',
  server_error: 'Un problème est survenu. Réessayez.',
  not_saved: 'Vos réponses ne sont pas encore enregistrées. Réessayez dans un instant.'
};
function errCopy(e) {
  const code = e && e.code;
  if (curExam() === 'tef' && FR[code]) return FR[code];
  return (e && e.message) || 'Something went wrong. Try again.';
}
function handleError(e) {
  if (e && e.code === 'unauthorized') { APP.me = null; go('/login'); return; }
  if (e && e.code === 'plan_required') { upsellModal(e.message); return; }
  toast(errCopy(e));
}
function go(path) { if (location.hash !== '#' + path) location.hash = path; else route(); }

/* ---------------- audio (studio voices) ---------------- */
const AUDIO = new Audio(); AUDIO.preload = 'auto';
let playResolve = null;
function stopAudio() { try { AUDIO.pause(); } catch { /* ignore */ } if (playResolve) { const r = playResolve; playResolve = null; r(true); } }
function playUrl(url) {
  return new Promise((res) => {
    stopAudio();
    playResolve = res;
    const done = (ok) => { if (playResolve === res) { playResolve = null; res(ok); } };
    AUDIO.onended = () => done(true);
    AUDIO.onerror = () => done(false);
    AUDIO.src = url;
    AUDIO.play().catch(() => done(false));
  });
}
function audioSeries(base, n) {
  const cache = {}; const urls = []; let active = 0; const waiting = [];
  const run = (fn) => new Promise((res) => { const go2 = () => { active++; fn().then(res, () => res(null)).finally(() => { active--; const nx = waiting.shift(); if (nx) nx(); }); }; if (active < 2) go2(); else waiting.push(go2); });
  const fetchOne = (i) => cache[i] || (cache[i] = run(() => fetch(base + '&c=' + i, { credentials: 'same-origin' }).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (!b) return null; const u = URL.createObjectURL(b); urls.push(u); return u; })));
  return {
    prefetch(i) { if (i != null && i >= 0 && i < n) fetchOne(i); },
    async play(i, cancelled) { if (i == null || i < 0 || i >= n) return true; const u = await fetchOne(i); if (cancelled && cancelled()) return true; if (!u) return false; return playUrl(u); },
    dispose() { setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 1000); }
  };
}
const sayCache = new Map();
async function say(exam, text, opts = {}, cancelled) {
  const key = exam + '|' + (opts.role || '') + '|' + text;
  let url = sayCache.get(key);
  if (!url) {
    try {
      const r = await fetch('/api/tts/say', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-requested-with': 'prep-canada' }, body: JSON.stringify({ exam, text, role: opts.role }) });
      if (!r.ok) return false;
      url = URL.createObjectURL(await r.blob());
      if (sayCache.size > 60) { const first = sayCache.keys().next().value; URL.revokeObjectURL(sayCache.get(first)); sayCache.delete(first); }
      sayCache.set(key, url);
    } catch { return false; }
  }
  if (cancelled && cancelled()) return true;
  return playUrl(url);
}

/* ---------------- dictation (speech to text) ---------------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const canDictate = !!SR;
let rec = null; let recOn = false;
const MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
function refreshMic() { document.querySelectorAll('.btn.mic').forEach((b) => { b.classList.toggle('on', recOn); const s = b.querySelector('span'); if (s) s.textContent = recOn ? (curExam() === 'tef' ? 'Arrêter' : 'Stop') : (b.dataset.label || 'Speak'); }); }
function stopDictation() { recOn = false; if (rec) { try { rec.stop(); } catch { /* ignore */ } } rec = null; refreshMic(); }
function toggleDictation(getEl, lang, onChange) {
  if (recOn) { stopDictation(); return; }
  if (!SR) return;
  const el = getEl(); if (!el) return;
  const base = el.value ? el.value.replace(/\s*$/, ' ') : '';
  let finalText = '';
  rec = new SR(); rec.lang = lang; rec.continuous = true; rec.interimResults = true;
  rec.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) finalText += r[0].transcript.trim() + ' '; else interim += r[0].transcript; }
    const v = (base + finalText + interim).replace(/[ \t]+/g, ' ');
    const x = getEl(); if (x) { x.value = v; x.scrollTop = x.scrollHeight; }
    onChange(v);
  };
  rec.onend = () => { if (recOn && rec) { try { rec.start(); } catch { recOn = false; refreshMic(); } } };
  rec.onerror = (ev) => { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed' || ev.error === 'audio-capture') { recOn = false; toast(curExam() === 'tef' ? 'Le micro est bloqué. Autorisez-le dans les réglages du navigateur.' : 'The microphone is blocked. Allow it in your browser settings.'); refreshMic(); } };
  recOn = true;
  try { rec.start(); } catch { recOn = false; }
  refreshMic();
}
function micButton(act, label) { const l = label || 'Speak'; return '<button type="button" class="btn mic' + (recOn ? ' on' : '') + '" data-act="' + act + '" data-label="' + h(l) + '">' + MIC + '<span>' + (recOn ? (curExam() === 'tef' ? 'Arrêter' : 'Stop') : h(l)) + '</span></button>'; }

/* ---------------- plan helpers ---------------- */
function planLabel(p) { if (!p || p.plan === 'free') return 'Free'; return p.plan === 'duo' ? 'Duo' : 'Solo ' + String(p.exam || '').toUpperCase(); }
function planPill(exam) {
  const e = APP.ent[exam] || {}; const p = APP.me && APP.me.plan;
  const fr = exam === 'tef';
  if (e.paid) return '<a class="pill good" href="#/account">' + h(planLabel(p)) + ' · ' + (fr ? 'jusqu’au ' : 'until ') + h(fmtDate(p.until)) + '</a>';
  return '<a class="pill" href="#/plans">' + (fr ? 'Offre gratuite · voir les offres' : 'Free plan · see plans') + '</a>';
}
function upsell(exam, title, text) {
  const fr = exam === 'tef';
  return '<div class="panel"><p class="eyebrow">Solo &amp; Duo</p><h2>' + h(title) + '</h2><p style="max-width:62ch">' + h(text) + '</p><div class="row"><a class="btn primary" href="#/plans">' + (fr ? 'Voir les offres' : 'See plans') + '</a><span class="small muted">' + (fr ? 'À partir de ' : 'From ') + fmtTND((APP.config && APP.config.prices.solo.month) || 15) + (fr ? ' par mois' : ' a month') + '</span></div></div>';
}
function upsellModal(msg) {
  let m = $('#upsell');
  if (!m) { m = document.createElement('div'); m.id = 'upsell'; document.body.appendChild(m); }
  const fr = curExam() === 'tef';
  m.innerHTML = '<div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:30;display:grid;place-items:center;padding:16px"><div class="panel" role="dialog" aria-modal="true" aria-labelledby="up-t" style="max-width:440px;width:100%"><p class="eyebrow">Solo &amp; Duo</p><h2 id="up-t">' + (fr ? 'Passez à une offre payante' : 'Upgrade to keep going') + '</h2><p>' + h(msg) + '</p><div class="row"><a class="btn primary" href="#/plans" data-sa="close-upsell">' + (fr ? 'Voir les offres' : 'See plans') + '</a><button class="btn" data-sa="close-upsell">' + (fr ? 'Plus tard' : 'Not now') + '</button></div></div></div>';
}
function renewBanner() {
  const p = APP.me && APP.me.plan; if (!p || p.plan === 'free' || !p.until) return '';
  const days = Math.ceil((new Date(p.until) - Date.now()) / 86400000);
  if (days > 5) return '';
  return '<div class="banner small">Your ' + h(planLabel(p)) + ' plan ends on ' + h(fmtDate(p.until)) + ' (' + days + ' day' + (days === 1 ? '' : 's') + '). Plans don’t renew automatically. <a href="#/plans">Renew now</a></div>';
}

/* ---------------- header ---------------- */
/* ---------------- app chrome: side menu (desktop), tab bar (phones) ---------------- */
const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  map: '<path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
  plans: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M8 15h2M12 15h2M8 18h2M12 18h4"/>',
  admin: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  login: '<path d="M10 17l5-5-5-5M15 12H3M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/>'
};
const svgI = (k) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg>';
const badge = (t, c) => '<span class="xbadge" style="--xb:' + c + '">' + t + '</span>';
function navItems() {
  const me = APP.me;
  const items = [['home', '#/', svgI('home'), 'Home'], ['ielts', '#/ielts', badge('EN', '#B4263A'), 'IELTS'], ['tef', '#/tef', badge('FR', '#1F4FA8'), 'TEF'], ['paths', '#/paths', svgI('map'), 'Paths']];
  if (me) { items.push(['plans', '#/plans', svgI('plans'), 'Plans'], ['account', '#/account', svgI('user'), 'Account']); if (me.isAdmin) items.push(['admin', '#/admin', svgI('admin'), 'Admin']); }
  else items.push(['plans', '#/plans', svgI('plans'), 'Plans'], ['login', '#/login', svgI('login'), 'Sign in']);
  return items;
}
function renderChrome(active) {
  APP.active = active;
  const me = APP.me; const p = me && me.plan;
  const side = $('#side'), tab = $('#tabbar'); if (!side || !tab) return;
  side.innerHTML = '<a class="brand" href="#/"><span class="mark">PC</span><div><b>Prep Canada</b><div class="sub">IELTS &amp; TEF coach</div></div></a>' +
    '<nav class="sidenav" aria-label="Main">' + navItems().filter(([k]) => me || !['ielts', 'tef'].includes(k)).map(([k, href, ic, label]) => '<a href="' + href + '"' + (active === k ? ' aria-current="page"' : '') + '>' + ic + '<span>' + label + '</span></a>').join('') + '</nav>' +
    (me ? '<a class="sideplan" href="#/' + (p.plan === 'free' ? 'plans' : 'account') + '"><span class="small muted">Your plan</span><b>' + h(planLabel(p)) + '</b>' + (p.until ? '<span class="small muted">until ' + h(fmtDate(p.until)) + '</span>' : '<span class="small" style="color:var(--accent)">Upgrade →</span>') + '</a>'
      : '<a class="btn primary" href="#/signup" style="justify-content:center">Create free account</a>');
  const tabs = me ? [['home'], ['ielts'], ['tef'], ['paths'], ['account']] : [['home'], ['paths'], ['plans'], ['login']];
  const all = navItems();
  tab.innerHTML = tabs.map(([k]) => { const it = all.find((x) => x[0] === k); if (!it) return ''; const cur = active === k || (k === 'account' && ['plans', 'admin'].includes(active)); return '<a href="' + it[1] + '"' + (cur ? ' aria-current="page"' : '') + '>' + it[2] + '<span>' + it[3] + '</span></a>'; }).join('');
}
function mobileTop() {
  const me = APP.me;
  return '<header class="mtop"><a class="brand" href="#/"><span class="mark">PC</span><b>Prep Canada</b></a>' + (me ? '<a class="pill ' + (me.plan.plan === 'free' ? '' : 'good') + '" href="#/' + (me.plan.plan === 'free' ? 'plans' : 'account') + '">' + h(planLabel(me.plan)) + '</a>' : '<a class="btn sm primary" href="#/signup">Sign up</a>') + '</header>';
}
function topRow() { return mobileTop() + renewBanner(); }
function coachHeader(exam, nav, current, subtitle) {
  return '<div class="apphead">' + mobileTop() + renewBanner() + '<div class="modhead"><div class="modtitle">' + badge(exam === 'tef' ? 'FR' : 'EN', exam === 'tef' ? '#1F4FA8' : '#B4263A') + '<div><b>' + (exam === 'tef' ? 'TEF Canada' : 'IELTS General Training') + '</b><span class="small muted">' + h(subtitle || '') + '</span></div></div><nav class="nav" aria-label="Sections">' + nav.map(([v, l]) => '<button data-nav="' + v + '" ' + (current === v ? 'aria-current="page"' : '') + '>' + h(l) + '</button>').join('') + '</nav></div></div>';
}
function footer() {
  const c = APP.config || {};
  return '<footer class="foot"><a href="#/legal/terms">Terms</a><a href="#/legal/privacy">Privacy</a>' + (c.support ? '<span>Help: <span style="user-select:all">' + h(c.support) + '</span></span>' : '') + '<span>Not affiliated with IELTS, IDP, the British Council, Cambridge or CCI Paris Île-de-France. Scores are estimates.</span></footer>';
}

/* ---------------- coach context ---------------- */
function makeCtx(exam) {
  return {
    toast, errCopy, handleError, api,
    getDoc: (ex, key) => api('GET', '/api/docs/' + ex + '/' + key).then((r) => r.data),
    putDoc: (ex, key, val) => api('PUT', '/api/docs/' + ex + '/' + key, { data: val }),
    ai: (ex, task, params) => api('POST', '/api/ai', Object.assign({ exam: ex, task }, params || {})),
    header: coachHeader,
    afterRender: () => {
      const f = $('#app'); if (!f) return;
      const focus = !f.querySelector('.modhead');   // test flow (intro, sections, marking) renders without the section tabs
      document.body.classList.toggle('focus', focus);
      if (APP.active !== exam) renderChrome(exam);
      if (!focus && !f.querySelector('.foot')) f.insertAdjacentHTML('beforeend', footer());
    },
    firstName: () => ((APP.me && APP.me.name) || '').split(' ')[0] || (exam === 'tef' ? '' : 'there'),
    planPill, ent: (ex) => APP.ent[ex] || {}, upsell,
    stopAudio, audioSeries, say,
    canDictate, toggleDictation, stopDictation, micButton: (act, label) => micButton(act, label || (exam === 'tef' ? 'Parler' : 'Speak'))
  };
}
function getCoach(name) {
  if (!APP.coaches[name]) APP.coaches[name] = name === 'ielts' ? createIELTS(makeCtx('ielts')) : createTEF(makeCtx('tef'));
  return APP.coaches[name];
}

/* ---------------- immigration paths ---------------- */
const PV = createPaths({
  me: () => APP.me, toast,
  getDoc: (ns, key) => api('GET', '/api/docs/' + ns + '/' + key).then((r) => r.data),
  putDoc: (ns, key, val) => api('PUT', '/api/docs/' + ns + '/' + key, { data: val }),
  render: (active, html) => page(active, html)
});

/* ---------------- pages ---------------- */
function setupBanner() { const s = APP.setup; if (!s) return ''; return '<div class="banner bad"><b>Setup not finished.</b> The owner still needs to add: ' + h((s.missing || []).concat(s.db === false && !(s.missing || []).includes('DATABASE_URL') ? ['a working database connection'] : []).join(', ')) + '. Sign-up will work once this is done.</div>'; }
function page(active, body) { renderChrome(active); document.body.classList.remove('focus'); $('#app').innerHTML = topRow(active) + setupBanner() + body + footer(); window.scrollTo(0, 0); }

function viewLanding() {
  const pr = (APP.config && APP.config.prices) || { solo: { month: 15 }, duo: { month: 25 } };
  page('home', '<section class="panel hero"><p class="eyebrow">IELTS General Training · TEF Canada</p><h1>Reach your CLB target for Canada</h1><p class="lead">Start with a full placement test in the real format and timings. You get a course built on your weak points, and new mock tests at your level whenever you want one.</p>' +
    '<div class="row"><a class="btn primary" href="#/signup">Take the free placement test</a><a class="btn" href="#/login">Sign in</a></div></section>' +
    '<div class="grid">' +
    '<div class="panel examcard" style="--c:#B4263A"><span class="tag">IELTS GENERAL TRAINING</span><h2>English</h2><p class="muted">Listening, Reading, Writing and Speaking, with band scores and your CLB level for each skill.</p></div>' +
    '<div class="panel examcard" style="--c:#1F4FA8"><span class="tag">TEF CANADA</span><h2>Français</h2><p class="muted">Compréhension et expression, orales et écrites, with scores out of 699 and your NCLC level.</p></div>' +
    '<div class="panel"><h3>How it works</h3><ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px"><li>Placement test in all four skills</li><li>Writing and speaking marked against the official criteria, with your errors quoted</li><li>A 12-unit course built on your results</li><li>Unlimited new mock tests that adapt to your level</li></ol></div></div>' +
    '<a class="panel flat" href="#/paths" style="text-decoration:none;color:inherit"><div class="row between"><div><h3>Every immigration path, as a map</h3><p class="muted">Express Entry, the French draws, Québec, provinces, community pilots, study routes: each one step by step, with documents, time and cost.</p></div><span class="btn">Explore the paths</span></div></a>' +
    '<div class="panel flat"><div class="row between"><div><h3>Free to start</h3><p class="muted">The placement test and one mock a month are free. Unlimited tests, the course and studio voices start at ' + fmtTND(pr.solo.month) + ' a month.</p></div><a class="btn" href="#/plans">See plans</a></div></div>');
}

function authShell(title, inner) { page('auth', '<div class="auth"><div class="panel"><h1 style="font-size:1.8rem">' + title + '</h1>' + inner + '</div></div>'); }
function viewLogin(q) {
  authShell('Sign in', '<form id="f-login" class="stack"><label class="field"><span>Email</span><input type="email" id="l-email" autocomplete="email" required></label><label class="field"><span>Password</span><input type="password" id="l-pass" autocomplete="current-password" required></label><input type="hidden" id="l-next" value="' + h(q.next || '') + '"><p class="banner bad small" id="l-err" hidden></p><button class="btn primary" type="submit">Sign in</button></form><div class="row between small"><a href="#/forgot">Forgot your password?</a><a href="#/signup">Create an account</a></div>');
}
function viewSignup() {
  authShell('Create your account', '<p class="muted">Free: a placement test for each exam and one mock test a month.</p><form id="f-signup" class="stack"><label class="field"><span>Your name</span><input type="text" id="s-name" autocomplete="name" required maxlength="80" style="width:100%"></label><label class="field"><span>Email</span><input type="email" id="s-email" autocomplete="email" required></label><label class="field"><span>Password (at least 8 characters)</span><input type="password" id="s-pass" autocomplete="new-password" minlength="8" required></label>' +
    '<label class="check"><input type="checkbox" id="s-consent"><span>I accept the <a href="#/legal/terms" target="_blank">terms</a> and the <a href="#/legal/privacy" target="_blank">privacy policy</a>, including that my answers are processed by an AI service (Google Gemini) outside Tunisia to create and mark my tests.</span></label>' +
    '<p class="banner bad small" id="s-err" hidden></p><button class="btn primary" type="submit">Create account</button></form><p class="small">Already have an account? <a href="#/login">Sign in</a></p>');
}
function viewForgot() {
  authShell('Reset your password', '<form id="f-forgot" class="stack"><label class="field"><span>Email</span><input type="email" id="fg-email" required></label><p class="small" id="fg-msg" hidden></p><button class="btn primary" type="submit">Send reset link</button></form><p class="small"><a href="#/login">Back to sign in</a></p>');
}
function viewReset(q) {
  authShell('Choose a new password', '<form id="f-reset" class="stack"><input type="hidden" id="rs-token" value="' + h(q.token || '') + '"><label class="field"><span>New password (at least 8 characters)</span><input type="password" id="rs-pass" minlength="8" required autocomplete="new-password"></label><p class="banner bad small" id="rs-err" hidden></p><button class="btn primary" type="submit">Save password</button></form>');
}

async function viewHome() {
  const p = APP.me.plan;
  const card = (ex, c, title, sub, lang) => '<a class="panel examcard" style="--c:' + c + '" href="#/' + ex + '"><div class="row between"><span class="tag">' + title + '</span>' + badge(ex === 'tef' ? 'FR' : 'EN', c) + '</div><h2>' + sub + '</h2><div class="stack" style="gap:6px" id="sum-' + ex + '"><p class="muted small">' + lang + '</p></div><div class="row">' + (APP.ent[ex].paid ? '<span class="pill good">Included in your plan</span>' : '<span class="pill">Free plan</span>') + '</div></a>';
  page('home', '<div><p class="eyebrow">' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '</p><h1>Welcome, ' + h(APP.me.name.split(' ')[0]) + '</h1></div>' +
    '<section class="panel today" aria-labelledby="today-t"><h2 id="today-t">Today</h2><div id="today" class="actions"><div class="row"><span class="spinner"></span><span class="muted small">Loading your next steps…</span></div></div></section>' +
    '<div class="grid">' + card('ielts', '#B4263A', 'IELTS GENERAL TRAINING', 'English coach', 'Band scores and CLB levels.') + card('tef', '#1F4FA8', 'TEF CANADA', 'Coach de français', 'Scores sur 699 et niveaux NCLC.') + '</div>' +
    '<div id="home-path"></div>' +
    installPanel() +
    (p.plan === 'free' ? '<div class="panel flat"><div class="row between"><div><h3>Unlock unlimited practice</h3><p class="muted small">Unlimited mock tests, your personal course and studio voices for Listening.</p></div><a class="btn primary" href="#/plans">See plans</a></div></div>' : ''));
  const act = (href, icon, title, sub, primary) => '<a class="action' + (primary ? ' primary' : '') + '" href="' + href + '"><span class="aic">' + icon + '</span><span class="atext"><b>' + h(title) + '</b>' + (sub ? '<span class="small muted">' + h(sub) + '</span>' : '') + '</span><span class="achev" aria-hidden="true">›</span></a>';
  const [ie, te] = await Promise.all(['ielts', 'tef'].map((ex) => api('GET', '/api/docs/' + ex + '/profile').then((r) => r.data).catch(() => null)));
  await Promise.all([PV.load().catch(() => {}), PV.loadDraws().catch(() => null)]);
  if (!$('#today')) return;
  const acts = [];
  if (ie && ie.activeAttemptId) acts.push(act('#/ielts', badge('EN', '#B4263A'), 'Resume your IELTS test', 'Your answers are saved', true));
  if (te && te.activeAttemptId) acts.push(act('#/tef', badge('FR', '#1F4FA8'), 'Reprendre votre test TEF', 'Vos réponses sont enregistrées', true));
  const ps = PV.pinnedSummary();
  if (ps && ps.next) acts.push(act('#/paths/' + ps.p.id, svgI('map'), 'Next stop: ' + ps.next.title, ps.p.name + ' · ' + ps.done + ' of ' + ps.p.stops.length + ' done', !acts.length));
  if (!ie || !ie.placementDone) acts.push(act('#/ielts', badge('EN', '#B4263A'), ie && ie.setupDone ? 'Take the IELTS placement test' : 'Set up your IELTS coach', 'About 2 h 50 min, with breaks', !acts.length));
  else acts.push(act('#/ielts', badge('EN', '#B4263A'), 'Practise IELTS', 'Mock tests and your course', false));
  if (!te || !te.placementDone) acts.push(act('#/tef', badge('FR', '#1F4FA8'), te && te.setupDone ? 'Passer le test de positionnement TEF' : 'Configurer votre coach TEF', 'Environ 2 h 55, avec pauses', false));
  else acts.push(act('#/tef', badge('FR', '#1F4FA8'), 'S’entraîner au TEF', 'Tests blancs et parcours', false));
  const pf = PV.profile(); const fd = PV.frenchCut();
  acts.push(act('#/paths/score', svgI('calc'), pf ? 'Your CRS score: ' + PV.score() : 'Calculate your CRS score', fd ? 'Latest French draw: ' + fd.crs + ' · CEC: ' + (PV.cecCut() || {}).crs : 'Express Entry points out of 1,200', false));
  if (!ps) acts.push(act('#/paths', svgI('map'), 'Find your immigration path', '11 routes to PR as maps', false));
  $('#today').innerHTML = acts.slice(0, 5).join('');
  const put = (ex, d) => {
    const el = $('#sum-' + ex); if (!el || !d) return;
    if (ex === 'ielts') { const b = d.bands || {}; el.innerHTML = '<p class="mono">L ' + (b.L ?? '–') + ' · R ' + (b.R ?? '–') + ' · W ' + (b.W ?? '–') + ' · S ' + (b.S ?? '–') + '</p><p class="small muted">' + (d.placementDone ? 'Target CLB ' + (d.clbTarget || 9) : 'Placement test not taken yet') + '</p>'; }
    else { const sc = d.scores || {}; el.innerHTML = '<p class="mono">CO ' + (sc.L ?? '–') + ' · CE ' + (sc.R ?? '–') + ' · EE ' + (sc.W ?? '–') + ' · EO ' + (sc.S ?? '–') + '</p><p class="small muted">' + (d.placementDone ? 'Objectif NCLC ' + (d.target || 7) : 'Test de positionnement à faire') + '</p>'; }
  };
  put('ielts', ie); put('tef', te);
  const el = $('#home-path');
  if (el && ps) el.innerHTML = '<a class="panel pinned" href="#/paths/' + ps.p.id + '" style="--pc:' + ps.p.color + '"><p class="eyebrow">Your immigration path</p><h2>' + h(ps.p.name) + '</h2>' + miniTrail(ps.p, ps.done) + '<p>' + ps.done + ' of ' + ps.p.stops.length + ' stops done' + (ps.next ? ' · next: <b>' + h(ps.next.title) + '</b>' : '') + '</p></a>';
}
function installPanel() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (APP.installEvt) return '<div class="panel flat"><div class="row between"><div><h3>Install the app</h3><p class="muted small">Open Prep Canada from your home screen, full screen, like any app.</p></div><button class="btn" data-sa="install">Install</button></div></div>';
  if (ios) return '<div class="panel flat"><h3>Install on iPhone</h3><p class="muted small">In Safari, tap the Share button, then “Add to Home Screen”.</p></div>';
  return '';
}

function viewPlans() {
  const c = APP.config; const pr = c.prices; const b = APP.billing; const me = APP.me;
  const cur = me ? me.plan : { plan: 'free' };
  const per = b.period === 'year' ? '/ year' : '/ month';
  const price = (plan) => pr[plan][b.period];
  const card = (plan, title, feats, featured) => {
    const isCur = cur.plan === plan;
    return '<div class="panel plan' + (featured ? ' featured' : '') + '"><div class="row between"><h2>' + title + '</h2>' + (featured ? '<span class="pill accent">Best value</span>' : '') + (isCur ? '<span class="pill good">Your plan</span>' : '') + '</div>' +
      '<div class="price">' + (plan === 'free' ? '0' : price(plan)) + ' <small>TND ' + (plan === 'free' ? '' : per) + '</small></div>' +
      (plan !== 'free' && b.period === 'year' ? '<p class="small muted">' + (pr[plan].month * 12 - pr[plan].year) + ' TND less than 12 monthly payments</p>' : '') +
      '<ul>' + feats.map((f) => '<li>' + f + '</li>').join('') + '</ul>' +
      (plan === 'solo' ? '<div class="seg" role="group" aria-label="Exam">' + ['ielts', 'tef'].map((x) => '<button type="button" data-sa="solo-exam" data-x="' + x + '" aria-pressed="' + (b.exam === x) + '">' + x.toUpperCase() + '</button>').join('') + '</div>' : '') +
      (plan === 'free' ? (me ? '' : '<a class="btn" href="#/signup">Create a free account</a>') : '<button class="btn ' + (featured ? 'primary' : 'dark') + '" data-sa="choose" data-plan="' + plan + '">' + (isCur ? 'Extend' : 'Choose ' + title) + '</button>') + '</div>';
  };
  let checkout = '';
  if (b.plan && me) {
    const m = c.methods;
    const label = b.plan === 'duo' ? 'Duo · IELTS + TEF' : 'Solo · ' + b.exam.toUpperCase();
    const methods = [
      ['konnect', 'Konnect', 'Bank card, e-Dinar or Konnect wallet'],
      ['flouci', 'Flouci', 'Flouci wallet or bank card'],
      ['manual', 'D17 or bank transfer', 'Send the money, enter the reference, and we activate it (usually within 24 hours)']
    ].filter(([k]) => m[k]);
    checkout = '<div class="panel" id="checkout"><p class="eyebrow">Checkout</p><h2>' + h(label) + ' · ' + fmtTND(price(b.plan)) + ' ' + (b.period === 'year' ? 'for 12 months' : 'for 1 month') + '</h2>' +
      '<p class="small muted">Price includes VAT. Prepaid: nothing renews automatically, and we remind you a few days before it ends.' + (cur.plan === 'solo' && b.plan === 'duo' ? ' Unused Solo days are credited to Duo.' : '') + '</p>' +
      '<div class="methods">' + methods.map(([k, t, d]) => '<label class="choice"><input type="radio" name="paymethod" value="' + k + '" ' + (b.method === k ? 'checked' : '') + '><span class="mono"></span><span><b>' + t + '</b><br><span class="small muted">' + d + '</span></span></label>').join('') + '</div>' +
      (b.method === 'manual' ? '<div class="panel flat"><p style="white-space:pre-line">' + h(c.manualInfo) + '</p><p class="small">Amount: <b>' + fmtTND(price(b.plan)) + '</b>. Put your email in the transfer note if you can.</p><label class="field"><span>D17 or transfer reference</span><input type="text" id="pay-ref" maxlength="120" style="width:100%"></label></div>' : '') +
      '<p class="banner bad small" id="pay-err" hidden></p><div class="row"><button class="btn primary" data-sa="pay" ' + (b.method ? '' : 'disabled') + '>' + (b.method === 'manual' ? 'Send for activation' : 'Pay ' + fmtTND(price(b.plan))) + '</button><button class="btn" data-sa="cancel-checkout">Cancel</button></div></div>';
  }
  page('plans', '<div><p class="eyebrow">Plans</p><h1>Choose how you prepare</h1></div>' +
    '<div class="row"><div class="seg" role="group" aria-label="Billing period"><button type="button" data-sa="period" data-p="month" aria-pressed="' + (b.period === 'month') + '">Monthly</button><button type="button" data-sa="period" data-p="year" aria-pressed="' + (b.period === 'year') + '">Yearly · 2 months free</button></div></div>' +
    '<div class="plans">' +
    card('free', 'Free', ['Placement test for each exam', '1 mock test a month', 'Marking with quoted errors', 'Device voices for Listening']) +
    card('solo', 'Solo', ['One exam: IELTS or TEF', 'Unlimited mock tests', 'Personal 12-unit course with lessons', 'Studio voices for Listening and speaking', 'Timed checkpoints']) +
    card('duo', 'Duo', ['IELTS and TEF together', 'Everything in Solo, for both exams', 'Best for bilingual Express Entry points'], true) +
    '</div>' + checkout +
    '<p class="small muted">Prices in Tunisian dinars, VAT included. Fair use: up to ' + ((c.limits && c.limits.paid.testsPerDay) || 6) + ' new tests a day.</p>');
  if (b.plan) { const el = $('#checkout'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}

async function viewBillingReturn(q) {
  page('plans', '<div class="panel" id="ret"><div class="row"><span class="spinner"></span><h2>Checking your payment…</h2></div></div>');
  const fail = q.fail === '1';
  let last = null;
  for (let i = 0; i < 8; i++) {
    try { last = await api('GET', '/api/billing/verify?id=' + encodeURIComponent(q.pid || '')); } catch (e) { last = { error: e }; break; }
    if (last.payment.status === 'paid' || last.payment.status === 'failed' || last.payment.method === 'manual') break;
    if (fail && i >= 1) break;
    await new Promise((r) => setTimeout(r, 2500));
  }
  await loadMe();
  const el = $('#ret'); if (!el) return;
  if (last && last.payment && last.payment.status === 'paid') {
    el.innerHTML = '<p class="eyebrow">Payment received</p><h2>You’re on ' + h(planLabel(last.plan)) + '</h2><p>Your plan runs until <b>' + h(fmtDate(last.plan.until)) + '</b>. Thank you.</p><div class="row"><a class="btn primary" href="#/">Start practising</a><a class="btn" href="#/account">See receipt</a></div>';
  } else if (last && last.payment && last.payment.status === 'review') {
    el.innerHTML = '<h2>Waiting for activation</h2><p>We received your reference. Your plan starts as soon as the payment is confirmed, usually within 24 hours.</p><a class="btn" href="#/">Back to the app</a>';
  } else {
    el.innerHTML = '<h2>' + (fail ? 'The payment didn’t go through' : 'Payment not confirmed yet') + '</h2><p class="muted">' + (fail ? 'No money was taken for this attempt. You can try again or choose another method.' : 'If you completed the payment, it can take a minute to arrive. Check again, or contact us with this reference: ') + '<span class="mono" style="user-select:all">' + h(q.pid || '') + '</span></p><div class="row"><button class="btn primary" data-sa="recheck">Check again</button><a class="btn" href="#/plans">Back to plans</a></div>';
  }
}

async function viewAccount() {
  const me = APP.me; const p = me.plan;
  page('account', '<div><p class="eyebrow">Account</p><h1>' + h(me.name) + '</h1><p class="muted">' + h(me.email) + '</p></div>' +
    '<div class="panel"><div class="row between"><div><h3>Your plan</h3><p>' + h(planLabel(p)) + (p.until ? ' · until <b>' + h(fmtDate(p.until)) + '</b>' : '') + '</p></div><a class="btn ' + (p.plan === 'free' ? 'primary' : '') + '" href="#/plans">' + (p.plan === 'free' ? 'Upgrade' : 'Extend or change') + '</a></div></div>' +
    '<div class="panel"><h3>Payments and receipts</h3><div id="pays"><span class="spinner"></span></div></div>' +
    '<div class="grid"><form class="panel" id="f-name"><h3>Name</h3><label class="field"><span>Your name</span><input type="text" id="a-name" value="' + h(me.name) + '" maxlength="80" style="width:100%"></label><button class="btn sm" type="submit">Save</button></form>' +
    '<form class="panel" id="f-pass"><h3>Password</h3><label class="field"><span>Current password</span><input type="password" id="a-old" autocomplete="current-password" required></label><label class="field"><span>New password</span><input type="password" id="a-new" minlength="8" autocomplete="new-password" required></label><button class="btn sm" type="submit">Change password</button></form></div>' +
    '<div class="panel flat"><h3>Your data</h3><p class="small muted">Download everything we store about you, or delete your account. Payment records are kept for accounting, as the law requires.</p><div class="row"><a class="btn sm" href="/api/me/export" download="prep-canada-data.json">Download my data</a><button class="btn sm" data-sa="logout">Sign out</button></div>' +
    '<details><summary>Delete my account</summary><form id="f-delete" class="stack" style="margin-top:10px"><p class="small">This erases your tests, results and course for both exams. It cannot be undone.</p><label class="field"><span>Type your password to confirm</span><input type="password" id="d-pass" required></label><button class="btn sm" type="submit" style="border-color:var(--bad);color:var(--bad)">Delete my account</button></form></details></div>');
  try {
    const r = await api('GET', '/api/billing/payments');
    const c = APP.config;
    $('#pays').innerHTML = r.payments.length ? '<div class="tablewrap"><table><thead><tr><th>Date</th><th>Plan</th><th>Method</th><th class="mono">Amount</th><th>Status</th><th>Receipt</th></tr></thead><tbody>' + r.payments.map((x) => '<tr><td class="mono">' + h(fmtDate(x.createdAt)) + '</td><td>' + h(planLabel({ plan: x.plan, exam: x.exam })) + ' · ' + (x.period === 'year' ? '12 months' : '1 month') + '</td><td>' + h(x.method) + '</td><td class="mono">' + fmtTND(x.amount) + '</td><td><span class="pill ' + (x.status === 'paid' ? 'good' : x.status === 'review' || x.status === 'pending' ? 'warn' : 'bad') + '">' + h(x.status) + '</span></td><td>' + (x.status === 'paid' ? '<button class="btn sm" data-sa="receipt" data-id="' + h(x.id) + '">View</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' + (c.matricule ? '' : '') : '<p class="muted">No payments yet.</p>';
    APP.payments = r.payments;
  } catch (e) { $('#pays').textContent = errCopy(e); }
}
function receipt(id) {
  const x = (APP.payments || []).find((p) => p.id === id); if (!x) return;
  const c = APP.config; const ttc = Number(x.amount); const ht = Math.round(ttc / 1.19 * 1000) / 1000; const tva = Math.round((ttc - ht) * 1000) / 1000;
  page('account', '<div class="row"><a class="btn sm" href="#/account">← Account</a></div><div class="panel legal"><p class="eyebrow">Receipt</p><h2>' + h(c.business || 'Prep Canada') + '</h2>' + (c.matricule ? '<p class="small">Matricule fiscal: ' + h(c.matricule) + '</p>' : '') +
    '<div class="tablewrap"><table><tbody><tr><th>Receipt no.</th><td class="mono">' + h(x.id) + '</td></tr><tr><th>Date</th><td>' + h(fmtDate(x.paidAt || x.createdAt)) + '</td></tr><tr><th>Customer</th><td>' + h(APP.me.name) + ' · ' + h(APP.me.email) + '</td></tr><tr><th>Service</th><td>Prep Canada ' + h(planLabel({ plan: x.plan, exam: x.exam })) + ', ' + (x.period === 'year' ? '12 months' : '1 month') + '</td></tr><tr><th>Amount excl. VAT (HT)</th><td class="mono">' + fmtTND(ht) + '</td></tr><tr><th>VAT 19%</th><td class="mono">' + fmtTND(tva) + '</td></tr><tr><th>Total incl. VAT (TTC)</th><td class="mono"><b>' + fmtTND(ttc) + '</b></td></tr><tr><th>Paid with</th><td>' + h(x.method) + '</td></tr></tbody></table></div><p class="small muted">Keep this page for your records.</p></div>');
}

async function viewAdmin() {
  if (!APP.me.isAdmin) { go('/'); return; }
  page('admin', '<div><p class="eyebrow">Admin</p><h1>Overview</h1></div><div class="kpis" id="kpis"><span class="spinner"></span></div>' +
    '<div class="panel"><div class="row between"><h2>Payments</h2><select id="adm-pst"><option value="review">Waiting for review</option><option value="pending">Pending (online)</option><option value="paid">Paid</option><option value="all">All</option></select></div><div id="adm-pays"><span class="spinner"></span></div></div>' +
    '<div class="panel"><div class="row between"><h2>AI costs and cache</h2><span class="small muted">This month</span></div><div id="adm-costs"><span class="spinner"></span></div></div>' +
    '<div class="panel"><h2>Test pool</h2><p class="small muted" style="max-width:70ch">Tests are written once and reused by other learners at the same level. Nobody gets the same part twice. Fill the pool before launch so the first users get instant tests. Listening parts can also be voiced in advance.</p>' +
    '<form id="f-fill" class="row"><select id="fl-exam"><option value="ielts">IELTS</option><option value="tef">TEF</option></select><select id="fl-k"><option value="all">All sections</option><option value="L">Listening</option><option value="R">Reading</option><option value="W">Writing</option><option value="S">Speaking</option></select><select id="fl-diff"><option value="exam">Exam standard</option><option value="foundation">Foundation</option><option value="advanced">Advanced</option></select><label class="small">Sets <input type="text" id="fl-n" value="3" inputmode="numeric" style="width:56px"></label><label class="check small" style="grid-template-columns:22px auto"><input type="checkbox" id="fl-audio"><span>Voice Listening now</span></label><button class="btn sm primary" type="submit">Generate</button></form><p class="small" id="fl-status"></p><div id="adm-pool"></div></div>' +
    '<div class="panel"><h2>Invitation rounds</h2><p class="small muted" style="max-width:70ch">Express Entry refreshes itself from IRCC every 6 hours. Québec and provincial rounds are edited here as JSON (same shape as shown), no redeploy needed.</p><div id="adm-draws"><span class="spinner"></span></div></div>' +
    '<div class="panel"><h2>Users</h2><form id="f-users" class="row"><input type="search" id="adm-q" placeholder="Email or name" style="flex:1 1 220px"><button class="btn sm" type="submit">Search</button></form><div id="adm-users"></div></div>');
  loadAdmin();
}
async function loadAdmin() {
  try {
    const s = await api('GET', '/api/admin/stats');
    const act = s.active.reduce((a, x) => a + x.n, 0);
    $('#kpis').innerHTML = [['Users', s.users], ['Active paid plans', act], ['Revenue this month', fmtTND(s.revenueMonth)], ['Payments to review', s.toReview], ['Tests started (7 days)', s.testsWeek]].map(([l, v]) => '<div class="panel kpi"><span class="small muted">' + l + '</span><b>' + h(v) + '</b></div>').join('');
  } catch (e) { handleError(e); }
  loadAdminPays(); loadAdminUsers(); loadAdminCosts(); loadAdminDraws();
}
async function loadAdminDraws() {
  const el = $('#adm-draws'); if (!el) return;
  try {
    const r = await api('GET', '/api/admin/draws'); const c = r.current;
    const top = c.ee.rounds[0];
    el.innerHTML = '<p class="small">' + (c.live ? '<span class="pill good">Live from IRCC</span> ' : '<span class="pill warn">Using bundled data</span> ') + 'Latest Express Entry round: <b>#' + top.n + '</b> ' + h(top.date) + ' · ' + h(top.name) + ' · lowest ' + top.crs + (c.ee.fetchedAt ? ' · fetched ' + h(c.ee.fetchedAt.slice(0, 16).replace('T', ' ')) : '') + '</p>' +
      '<div class="row"><button class="btn sm" data-sa="adm-draws-refresh">Refresh from IRCC now</button><button class="btn sm" data-sa="adm-draws-reset">Back to bundled Québec/provinces</button></div>' +
      '<label class="stack" style="gap:6px"><span class="small muted">Québec and provinces (JSON)</span><textarea id="adm-draws-json" rows="14" class="mono" style="width:100%;font-size:.8rem">' + h(JSON.stringify({ checked: c.checked, quebec: c.quebec, provinces: c.provinces }, null, 2)) + '</textarea></label>' +
      '<div class="row"><button class="btn sm primary" data-sa="adm-draws-save">Save</button><span id="adm-draws-msg" class="small muted"></span></div>';
  } catch (e) { el.innerHTML = '<p class="small">' + h(e.message) + '</p>'; }
}
async function loadAdminCosts() {
  try {
    const r = await api('GET', '/api/admin/costs'); const fx = r.usdToTnd || 3.1;
    const tnd = (usd) => (usd * fx).toFixed(2) + ' TND';
    const rate = (c, n) => (n ? Math.round(100 * c / n) + '%' : '–');
    const perUser = r.paidUsers ? tnd(r.month.usd / r.paidUsers) : '–';
    const task = (name) => r.byTask.find((x) => x.task === name) || { calls: 0, cached: 0 };
    const genCalls = r.byTask.filter((x) => x.task === 'gen').reduce((a, x) => ({ calls: a.calls + x.calls, cached: a.cached + x.cached }), { calls: 0, cached: 0 });
    const t = task('tts');
    $('#adm-costs').innerHTML = '<div class="kpis">' + [['AI spend', tnd(r.month.usd) + '<br><span class="small muted">$' + r.month.usd.toFixed(2) + '</span>'], ['Per paying user', perUser], ['Tests from the pool', rate(genCalls.cached, genCalls.calls)], ['Voices from cache', rate(t.cached, t.calls)], ['Audio cache', r.audio.items + ' clips · ' + (r.audio.mb < 10 ? r.audio.mb.toFixed(1) : r.audio.mb.toFixed(0)) + ' MB']].map(([l, v]) => '<div class="panel kpi"><span class="small muted">' + l + '</span><b style="font-size:1.35rem">' + v + '</b></div>').join('') + '</div>' +
      '<div class="tablewrap"><table><thead><tr><th>Task</th><th class="mono">Calls</th><th class="mono">From cache</th><th class="mono">Cost</th></tr></thead><tbody>' + r.byTask.map((x) => '<tr><td>' + h(x.task) + '</td><td class="mono">' + x.calls + '</td><td class="mono">' + rate(x.cached, x.calls) + '</td><td class="mono">' + tnd(x.usd) + '</td></tr>').join('') + '</tbody></table></div>' +
      (r.top.length ? '<details><summary>Highest-cost users this month</summary><div class="tablewrap"><table><tbody>' + r.top.map((x) => '<tr><td>' + h(x.email) + '</td><td class="mono">' + tnd(x.usd) + '</td></tr>').join('') + '</tbody></table></div></details>' : '');
    const P = r.pool; const sk = { L: 'Listening', R: 'Reading', W: 'Writing', S: 'Speaking' };
    $('#adm-pool').innerHTML = '<div class="tablewrap"><table><thead><tr><th>Exam</th><th>Section</th><th>Level</th><th class="mono">Items</th><th class="mono">Times used</th><th class="mono">Retired</th></tr></thead><tbody>' + (P.buckets.length ? P.buckets.map((b) => '<tr><td>' + b.exam.toUpperCase() + '</td><td>' + sk[b.k] + '</td><td>' + h(b.diff) + '</td><td class="mono">' + b.items + '</td><td class="mono">' + b.uses + '</td><td class="mono">' + b.retired + '</td></tr>').join('') : '<tr><td colspan="6" class="muted">Empty. Generate a few sets, or it fills up as people take tests.</td></tr>') + '</tbody></table></div>' +
      '<p class="small muted">Lessons in the pool: ' + P.lessons.items + ' (used ' + P.lessons.uses + ' times).</p>' +
      (P.reported.length ? '<h3>Reported by learners</h3><div class="tablewrap"><table><thead><tr><th>Part</th><th>Topic</th><th class="mono">Reports</th><th>Reasons</th><th></th></tr></thead><tbody>' + P.reported.map((x) => '<tr><td>' + x.exam.toUpperCase() + ' ' + sk[x.k] + ' ' + (x.i + 1) + ' · ' + h(x.diff) + '</td><td>' + h(x.topic) + '</td><td class="mono">' + x.reports + '</td><td class="small">' + h(x.reasons || '') + '</td><td><button class="btn sm" data-sa="adm-retire" data-id="' + h(x.id) + '" data-v="' + (x.retired ? '0' : '1') + '">' + (x.retired ? 'Restore' : 'Retire') + '</button></td></tr>').join('') + '</tbody></table></div>' : '');
  } catch (e) { handleError(e); }
}
async function fillPool() {
  const exam = $('#fl-exam').value; const kSel = $('#fl-k').value; const diff = $('#fl-diff').value;
  const sets = Math.max(1, Math.min(20, Number($('#fl-n').value) || 1)); const voice = $('#fl-audio').checked;
  const parts = { ielts: { L: 4, R: 3, W: 1, S: 1 }, tef: { L: 4, R: 4, W: 1, S: 1 } }[exam];
  const jobs = [];
  for (let n = 0; n < sets; n++) for (const k of (kSel === 'all' ? ['L', 'R', 'W', 'S'] : [kSel])) for (let i = 0; i < parts[k]; i++) jobs.push({ k, i });
  const st = $('#fl-status'); let done = 0, failed = 0;
  APP.filling = true;
  for (const j of jobs) {
    if (!APP.filling) break;
    if (st) st.textContent = 'Writing ' + (done + 1) + ' of ' + jobs.length + ' (' + j.k + ' part ' + (j.i + 1) + ')… keep this page open.';
    try {
      const r = await api('POST', '/api/admin/pool/fill', { exam, k: j.k, i: j.i, diff });
      if (!r.valid) failed++;
      if (voice && r.valid && j.k === 'L') {
        for (let c = 0; c < 80; c++) {
          if (st) st.textContent = 'Voicing Listening part ' + (j.i + 1) + ', clip ' + (c + 1) + '…';
          const a = await api('POST', '/api/admin/pool/' + r.id + '/audio', { c });
          if (a.done) break;
        }
      }
    } catch (e) { failed++; if (e.code === 'rate_limited') await new Promise((res) => setTimeout(res, 20000)); }
    done++;
  }
  APP.filling = false;
  if (st) st.textContent = 'Done: ' + (done - failed) + ' added' + (failed ? ', ' + failed + ' failed quality checks or errors' : '') + '.';
  loadAdminCosts();
}
async function loadAdminPays() {
  const st = ($('#adm-pst') || {}).value || 'review';
  try {
    const r = await api('GET', '/api/admin/payments?status=' + st);
    $('#adm-pays').innerHTML = r.payments.length ? '<div class="tablewrap"><table><thead><tr><th>Date</th><th>User</th><th>Plan</th><th class="mono">Amount</th><th>Method / ref</th><th>Status</th><th></th></tr></thead><tbody>' + r.payments.map((x) => '<tr><td class="mono">' + h(fmtDate(x.createdAt)) + '</td><td>' + h(x.email) + '</td><td>' + h(planLabel({ plan: x.plan, exam: x.exam })) + ' · ' + x.period + '</td><td class="mono">' + fmtTND(x.amount) + '</td><td>' + h(x.method) + (x.reference ? '<br><span class="mono small" style="user-select:all">' + h(x.reference) + '</span>' : '') + '</td><td>' + h(x.status) + '</td><td>' + (x.status !== 'paid' && x.status !== 'rejected' ? '<div class="row"><button class="btn sm primary" data-sa="adm-approve" data-id="' + h(x.id) + '">Approve</button><button class="btn sm" data-sa="adm-reject" data-id="' + h(x.id) + '">Reject</button></div>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">Nothing here.</p>';
  } catch (e) { handleError(e); }
}
async function loadAdminUsers() {
  const qv = ($('#adm-q') || {}).value || '';
  try {
    const r = await api('GET', '/api/admin/users?q=' + encodeURIComponent(qv));
    $('#adm-users').innerHTML = '<div class="tablewrap"><table><thead><tr><th>User</th><th>Joined</th><th>Plan</th><th>Change plan</th><th></th></tr></thead><tbody>' + r.users.map((u) => '<tr><td>' + h(u.name) + '<br><span class="small muted">' + h(u.email) + '</span>' + (u.disabled ? ' <span class="pill bad">disabled</span>' : '') + '</td><td class="mono">' + h(fmtDate(u.created_at)) + '</td><td>' + h(planLabel(u.active)) + (u.active.until ? '<br><span class="small muted">until ' + h(fmtDate(u.active.until)) + '</span>' : '') + '</td><td><div class="row"><select id="up-' + h(u.id) + '">' + [['free', 'Free'], ['solo:ielts', 'Solo IELTS'], ['solo:tef', 'Solo TEF'], ['duo', 'Duo']].map(([v, l]) => '<option value="' + v + '"' + ((u.active.plan === 'solo' ? 'solo:' + u.active.exam : u.active.plan) === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select><input type="text" id="ud-' + h(u.id) + '" value="30" inputmode="numeric" style="width:64px" aria-label="Days"><button class="btn sm" data-sa="adm-plan" data-id="' + h(u.id) + '">Apply</button></div></td><td><div class="row"><button class="btn sm" data-sa="adm-reset" data-id="' + h(u.id) + '">Reset password</button><button class="btn sm" data-sa="adm-disable" data-id="' + h(u.id) + '" data-v="' + (u.disabled ? '0' : '1') + '">' + (u.disabled ? 'Enable' : 'Disable') + '</button></div></td></tr>').join('') + '</tbody></table></div>';
  } catch (e) { handleError(e); }
}

function viewLegal(kind) {
  const c = APP.config || {};
  const biz = h(c.business || '[Business name, legal form and address]');
  const mf = h(c.matricule || '[matricule fiscal]');
  const sup = h(c.support || '[support email]');
  const inpdp = h(c.inpdp || '[INPDP declaration / authorisation number]');
  const terms = '<h1>Terms of use</h1><p class="muted">Last updated ' + fmtDate(new Date()) + '</p>' +
    '<h2>1. The service</h2><p>Prep Canada (“the service”) is operated by ' + biz + ', matricule fiscal ' + mf + '. It offers practice tests, marking and lessons for IELTS General Training and TEF Canada. Tests and lessons are written and marked by an AI system. Scores are estimates to guide your preparation. They are not official results, and the service is not affiliated with IELTS, IDP, the British Council, Cambridge University Press &amp; Assessment, or CCI Paris Île-de-France.</p>' +
    '<h2>2. Your account</h2><p>You must give accurate details and keep your password private. One account is for one person. We may suspend accounts used to abuse the service, for example by automated use or reselling access.</p>' +
    '<h2>3. Plans and payment</h2><p>Prices are in Tunisian dinars and include VAT. Paid plans are prepaid for one month or twelve months and do not renew automatically. A plan starts when the payment is confirmed. Manual payments (D17 or bank transfer) start when we confirm receipt. Upgrading from Solo to Duo credits your unused Solo days.</p>' +
    '<h2>4. Refunds</h2><p>If a technical problem on our side prevents you from using a paid plan, contact ' + sup + ' within 14 days of payment and we will extend your plan or refund you. Under Law No. 2000-83 on electronic commerce, you may have a right to withdraw; because the service starts immediately at your request, this right may no longer apply once you have used it.</p>' +
    '<h2>5. Fair use</h2><p>Paid plans include up to ' + ((c.limits && c.limits.paid.testsPerDay) || 6) + ' new tests a day and daily limits on AI requests, to keep the service fast and affordable for everyone.</p>' +
    '<h2>6. Content</h2><p>Practice material is generated for your personal preparation. You keep the rights to the answers you write. Do not copy the service or resell its content.</p>' +
    '<h2>7. Liability</h2><p>We work to make the tests accurate and close to the real exams, but we do not guarantee any result in an official test or immigration process.</p>' +
    '<h2>8. Contact and law</h2><p>Questions: ' + sup + '. These terms are governed by Tunisian law.</p>';
  const privacy = '<h1>Privacy policy</h1><p class="muted">Last updated ' + fmtDate(new Date()) + '</p>' +
    '<h2>Who is responsible</h2><p>' + biz + ' (matricule fiscal ' + mf + ') processes your personal data under Organic Law No. 2004-63 of 27 July 2004. Declaration to the INPDP: ' + inpdp + '. Contact: ' + sup + '.</p>' +
    '<h2>What we collect</h2><ul><li>Account details: name, email, a secured (hashed) password</li><li>Your study data: settings, test answers, spoken answers as text, scores and course progress</li><li>Payments: plan, amount, method, the payment provider’s reference. We never see or store your card details.</li></ul>' +
    '<h2>Why</h2><p>To provide the service you signed up for: creating and marking your tests, building your course, managing your plan, and keeping accounting records.</p>' +
    '<h2>Transfers outside Tunisia</h2><p>With your explicit consent at sign-up, your answers are sent to Google’s Gemini AI service to create and mark tests and to produce voices. Our database and hosting may also be located outside Tunisia. These transfers are subject to authorisation by the INPDP, which we request or hold as required.</p>' +
    '<h2>How long</h2><p>We keep your study data while your account exists. When you delete your account, it is erased. Payment records are kept for the period required by Tunisian tax law.</p>' +
    '<h2>Your rights</h2><p>You can access and download your data (Account › Download my data), correct it, object to its processing on legitimate grounds, and delete your account at any time. You can also contact the INPDP.</p>' +
    '<h2>Cookies</h2><p>We use one essential cookie to keep you signed in. No advertising or tracking cookies.</p>';
  page('legal', '<div class="panel legal">' + (kind === 'terms' ? terms : privacy) + '</div>');
}

/* ---------------- routing ---------------- */
function parseHash() { const x = location.hash.replace(/^#/, '') || '/'; const [path, qs] = x.split('?'); return { path: path || '/', q: Object.fromEntries(new URLSearchParams(qs || '')) }; }
async function route() {
  const { path, q } = parseHash();
  const coachName = path === '/ielts' ? 'ielts' : path === '/tef' ? 'tef' : null;
  if (APP.coach && APP.coachName !== coachName) { APP.coach.unmount(); APP.coach = null; APP.coachName = null; }
  document.documentElement.dataset.exam = coachName === 'tef' ? 'tef' : 'ielts';
  document.documentElement.lang = coachName === 'tef' ? 'fr' : 'en';
  const up = $('#upsell'); if (up) up.innerHTML = '';
  const publicPaths = ['/', '/login', '/signup', '/forgot', '/reset', '/legal/terms', '/legal/privacy', '/plans', '/paths'];
  if (path.startsWith('/paths')) { const sub = path.split('/')[2] || null; PV.show(sub && Object.keys(q).length ? sub + '?' + new URLSearchParams(q) : sub); return; }
  if (!APP.me && !publicPaths.includes(path)) { go('/login?next=' + encodeURIComponent(path)); return; }
  if (APP.me && (path === '/login' || path === '/signup')) { go('/'); return; }
  if (coachName) {
    try { localStorage.setItem('pc_last', coachName); } catch { /* ignore */ }
    APP.coach = getCoach(coachName); APP.coachName = coachName; APP.coach.mount(); window.scrollTo(0, 0); return;
  }
  switch (path) {
    case '/': return APP.me ? viewHome() : viewLanding();
    case '/login': return viewLogin(q);
    case '/signup': return viewSignup();
    case '/forgot': return viewForgot();
    case '/reset': return viewReset(q);
    case '/plans': return viewPlans();
    case '/billing/return': return viewBillingReturn(q);
    case '/account': return viewAccount();
    case '/admin': return viewAdmin();
    case '/legal/terms': return viewLegal('terms');
    case '/legal/privacy': return viewLegal('privacy');
    default: go('/');
  }
}

/* ---------------- events ---------------- */
function showErr(id, e) { const el = $(id); if (el) { el.textContent = errCopy(e); el.hidden = false; } }
document.addEventListener('submit', async (e) => {
  const f = e.target; if (!f.id || !f.id.startsWith('f-')) return;
  e.preventDefault();
  if (PV.onSubmit(f)) return;
  const btn = f.querySelector('button[type=submit]'); if (btn) btn.disabled = true;
  try {
    if (f.id === 'f-login') {
      await api('POST', '/api/auth/login', { email: $('#l-email').value, password: $('#l-pass').value });
      await loadMe(); const nx = $('#l-next').value; go(nx && nx.startsWith('/') ? nx : '/');
    } else if (f.id === 'f-signup') {
      await api('POST', '/api/auth/signup', { name: $('#s-name').value, email: $('#s-email').value, password: $('#s-pass').value, consent: $('#s-consent').checked });
      await loadMe(); go('/');
    } else if (f.id === 'f-forgot') {
      const r = await api('POST', '/api/auth/forgot', { email: $('#fg-email').value });
      const m = $('#fg-msg'); m.hidden = false;
      m.textContent = r.manual ? 'Password reset by email is not set up yet. Write to ' + (r.support || 'the support team') + ' from your account email and we will reset it for you.' : 'If an account exists for this email, a reset link is on its way. It works for one hour.';
    } else if (f.id === 'f-reset') {
      await api('POST', '/api/auth/reset', { token: $('#rs-token').value, password: $('#rs-pass').value });
      await loadMe(); toast('Password changed.'); go('/');
    } else if (f.id === 'f-name') {
      await api('POST', '/api/me', { name: $('#a-name').value }); await loadMe(); toast('Name saved.'); viewAccount();
    } else if (f.id === 'f-pass') {
      await api('POST', '/api/me', { password: $('#a-old').value, newPassword: $('#a-new').value }); toast('Password changed.'); f.reset();
    } else if (f.id === 'f-delete') {
      await api('DELETE', '/api/me', { password: $('#d-pass').value }); APP.me = null; APP.coaches = {}; toast('Your account was deleted.'); go('/');
    } else if (f.id === 'f-users') { await loadAdminUsers(); }
    else if (f.id === 'f-fill') { if (!APP.filling) fillPool(); }
  } catch (err) {
    const target = { 'f-login': '#l-err', 'f-signup': '#s-err', 'f-reset': '#rs-err' }[f.id];
    if (target) showErr(target, err); else handleError(err);
  } finally { if (btn) btn.disabled = false; }
});
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-sa]'); if (!t) return;
  if (PV.onClick(t)) return;
  const a = t.dataset.sa; const b = APP.billing;
  if (a === 'close-upsell') { const m = $('#upsell'); if (m) m.innerHTML = ''; return; }
  if (a === 'install' && APP.installEvt) { APP.installEvt.prompt(); APP.installEvt = null; return; }
  if (a === 'period') { b.period = t.dataset.p; viewPlans(); return; }
  if (a === 'solo-exam') { b.exam = t.dataset.x; viewPlans(); return; }
  if (a === 'choose') { if (!APP.me) { go('/signup'); return; } b.plan = t.dataset.plan; b.method = b.method || null; viewPlans(); return; }
  if (a === 'cancel-checkout') { b.plan = null; viewPlans(); return; }
  if (a === 'pay') {
    t.disabled = true;
    try {
      const r = await api('POST', '/api/billing/checkout', { plan: b.plan, period: b.period, exam: b.exam, method: b.method, reference: ($('#pay-ref') || {}).value });
      if (r.payUrl) { location.href = r.payUrl; return; }
      b.plan = null; go('/billing/return?pid=' + encodeURIComponent(r.id));
    } catch (err) { showErr('#pay-err', err); t.disabled = false; }
    return;
  }
  if (a === 'recheck') { route(); return; }
  if (a === 'logout') { try { await api('POST', '/api/auth/logout'); } catch { /* ignore */ } APP.me = null; APP.coaches = {}; go('/'); return; }
  if (a === 'receipt') { receipt(t.dataset.id); return; }
  if (a === 'adm-approve' || a === 'adm-reject') { try { await api('POST', '/api/admin/payments/' + t.dataset.id + '/' + (a === 'adm-approve' ? 'approve' : 'reject')); toast(a === 'adm-approve' ? 'Approved. The plan is active.' : 'Rejected.'); loadAdmin(); } catch (err) { handleError(err); } return; }
  if (a === 'adm-draws-refresh') { t.disabled = true; try { const r = await api('POST', '/api/admin/draws/refresh'); toast(r.live ? 'Updated from IRCC: round #' + r.latest.n : 'IRCC could not be reached; bundled data kept.'); loadAdminDraws(); } catch (err) { handleError(err); t.disabled = false; } return; }
  if (a === 'adm-draws-reset') { try { await api('DELETE', '/api/admin/draws'); toast('Back to the bundled data.'); loadAdminDraws(); } catch (err) { handleError(err); } return; }
  if (a === 'adm-draws-save') { let data; try { data = JSON.parse($('#adm-draws-json').value); } catch { $('#adm-draws-msg').textContent = 'That is not valid JSON.'; return; } try { await api('PUT', '/api/admin/draws', data); toast('Saved. Everyone sees it within 30 minutes.'); loadAdminDraws(); } catch (err) { $('#adm-draws-msg').textContent = err.message; } return; }
  if (a === 'adm-retire') { try { await api('POST', '/api/admin/pool/' + t.dataset.id + '/retire', { retired: t.dataset.v === '1' }); loadAdminCosts(); } catch (err) { handleError(err); } return; }
  if (a === 'adm-plan') { const v = $('#up-' + t.dataset.id).value.split(':'); try { await api('POST', '/api/admin/users/' + t.dataset.id + '/plan', { plan: v[0], exam: v[1], days: Number($('#ud-' + t.dataset.id).value) }); toast('Plan updated.'); loadAdminUsers(); } catch (err) { handleError(err); } return; }
  if (a === 'adm-reset') { try { const r = await api('POST', '/api/admin/users/' + t.dataset.id + '/reset-password'); t.outerHTML = '<span class="small">Temporary password: <b class="mono" style="user-select:all">' + h(r.tempPassword) + '</b></span>'; } catch (err) { handleError(err); } return; }
  if (a === 'adm-disable') { try { await api('POST', '/api/admin/users/' + t.dataset.id + '/disable', { disabled: t.dataset.v === '1' }); loadAdminUsers(); } catch (err) { handleError(err); } }
});
document.addEventListener('input', (e) => { if (e.target.form) PV.onInput(e.target.form); });
document.addEventListener('change', (e) => {
  if (e.target.form && e.target.form.id === 'f-crs') { PV.onInput(e.target.form); return; }
  if (e.target.name === 'paymethod') { APP.billing.method = e.target.value; viewPlans(); }
  if (e.target.id === 'adm-pst') loadAdminPays();
});
window.addEventListener('hashchange', route);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); APP.installEvt = e; });

/* ---------------- boot ---------------- */
async function loadMe() {
  PV.reset();
  try { const r = await api('GET', '/api/me'); APP.me = r.user; APP.ent = r.entitlements || {}; }
  catch { APP.me = null; APP.ent = {}; }
}
async function boot() {
  try { APP.config = await api('GET', '/api/config'); } catch { APP.config = { prices: { solo: { month: 15, year: 150 }, duo: { month: 25, year: 250 } }, methods: { manual: true }, manualInfo: '', limits: {} }; }
  await loadMe();
  try { const hl = await api('GET', '/api/health'); if (!hl.ok) APP.setup = hl; } catch { APP.setup = { missing: ['server'] }; }
  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}
boot();
