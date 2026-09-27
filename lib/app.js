// HTTP API. One handler for every /api/* route (used by Vercel and by server.js locally).
import { q, one } from './db.js';
import { err, HttpError, uid, sha256, hashPassword, checkPassword, parseCookies, clampStr, toArr, baseUrl, words } from './util.js';
import { activePlan, entitlements, isPaidFor, checkCanStart, requirePaid, bumpUsage, LIMITS, prices, EXAMS, activate } from './plans.js';
import { aiJSON, aiChat, tts } from './gemini.js';
import { checkout, verify, markPaid, byProviderRef, publicPayment, methods, manualInfo } from './payments.js';
import * as IELTS from './prompts/ielts.js';
import * as TEF from './prompts/tef.js';

const P = { ielts: IELTS, tef: TEF };
const COOKIE = 'pc_sess';
const SESSION_DAYS = 60;
const KEY_RE = /^[A-Za-z0-9_.-]{1,120}$/;
const SECTIONS = ['L', 'R', 'W', 'S'];

/* ---------------- plumbing ---------------- */
function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.statusCode = status;
  res.setHeader('content-type', isBuf ? (headers['content-type'] || 'application/octet-stream') : 'application/json; charset=utf-8');
  if (!headers['cache-control']) res.setHeader('cache-control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(isBuf ? body : JSON.stringify(body));
}
function redirect(res, to) { res.statusCode = 302; res.setHeader('location', to); res.end(); }
async function readBody(req) {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 1_500_000) throw err(413, 'too_large', 'Request too large.'); chunks.push(c); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw err(400, 'bad_json', 'Invalid JSON.'); }
}
function setSession(res, req, token) {
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') || process.env.NODE_ENV === 'production';
  res.setHeader('set-cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`);
}
function clearSession(res) { res.setHeader('set-cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`); }
async function newSession(res, req, userId) {
  const token = uid(32);
  await q(`insert into sessions(token_hash, user_id, expires_at) values($1,$2, now() + interval '${SESSION_DAYS} days')`, [sha256(token), userId]);
  setSession(res, req, token);
}
async function currentUser(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  return one(`select u.* from sessions s join users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at > now() and not u.disabled`, [sha256(token)]);
}
const isAdmin = (u) => !!u && String(process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean).includes(u.email);
function needUser(u) { if (!u) throw err(401, 'unauthorized', 'Please sign in.'); return u; }
function needAdmin(u) { needUser(u); if (!isAdmin(u)) throw err(403, 'forbidden', 'Admins only.'); return u; }
function needExam(ex) { if (!EXAMS.includes(ex)) throw err(400, 'bad_request', 'Unknown exam.'); return ex; }

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.created_at, plan: activePlan(u), isAdmin: isAdmin(u) };
}
async function getDoc(userId, exam, key) {
  const r = await one('select data from docs where user_id=$1 and exam=$2 and key=$3', [userId, exam, key]);
  return r ? r.data : null;
}
async function getAttempt(u, exam, id) {
  const a = await one('select * from attempts where id=$1 and user_id=$2 and exam=$3', [String(id || ''), u.id, exam]);
  if (!a) throw err(404, 'not_found', 'Test not found.');
  a.sectionList = a.sections.split(',');
  return a;
}

/* ---------------- routes ---------------- */
const routes = [];
const route = (method, path, fn) => routes.push({ method, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

route('GET', '/api/health', async () => {
  const missing = ['DATABASE_URL', 'GEMINI_API_KEY', 'ADMIN_EMAILS'].filter((k) => !process.env[k] && !(k === 'GEMINI_API_KEY' && process.env.GEMINI_MOCK === '1'));
  let db = false;
  if (process.env.DATABASE_URL) { try { await q('select 1'); db = true; } catch (e) { console.error('DB check failed', e.message); } }
  return { ok: !missing.length && db, missing, db };
});

route('GET', '/api/config', async () => ({
  prices: prices(), methods: methods(), manualInfo: manualInfo(),
  support: process.env.SUPPORT_EMAIL || '', business: process.env.BUSINESS_NAME || '', matricule: process.env.MATRICULE_FISCAL || '',
  inpdp: process.env.INPDP_DECLARATION || '', limits: LIMITS
}));

route('POST', '/api/auth/signup', async ({ req, res, body }) => {
  const email = clampStr(body.email, 200).trim().toLowerCase();
  const name = clampStr(body.name, 80).trim();
  const pw = String(body.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw err(400, 'bad_request', 'Enter a valid email address.');
  if (pw.length < 8) throw err(400, 'bad_request', 'Use a password of at least 8 characters.');
  if (!name) throw err(400, 'bad_request', 'Enter your name.');
  if (body.consent !== true) throw err(400, 'bad_request', 'Please accept the terms and the privacy policy.');
  const exists = await one('select id from users where email=$1', [email]);
  if (exists) throw err(409, 'exists', 'An account with this email already exists. Sign in instead.');
  const id = 'u_' + uid(10);
  await q('insert into users(id, email, pass_hash, name, consent_at) values($1,$2,$3,$4, now())', [id, email, hashPassword(pw), name]);
  await newSession(res, req, id);
  return { user: publicUser(await one('select * from users where id=$1', [id])) };
});

const failed = new Map();
route('POST', '/api/auth/login', async ({ req, res, body }) => {
  const email = clampStr(body.email, 200).trim().toLowerCase();
  const f = failed.get(email) || { n: 0, t: 0 };
  if (f.n >= 8 && Date.now() - f.t < 15 * 60000) throw err(429, 'rate_limited', 'Too many attempts. Wait 15 minutes, then try again.');
  const u = await one('select * from users where email=$1 and not disabled', [email]);
  if (!u || !checkPassword(String(body.password || ''), u.pass_hash)) {
    failed.set(email, { n: f.n + 1, t: Date.now() });
    await new Promise((r) => setTimeout(r, 400));
    throw err(401, 'bad_login', 'Wrong email or password.');
  }
  failed.delete(email);
  await newSession(res, req, u.id);
  return { user: publicUser(u) };
});

route('POST', '/api/auth/logout', async ({ req, res }) => {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) await q('delete from sessions where token_hash=$1', [sha256(token)]);
  clearSession(res);
  return { ok: true };
});

route('POST', '/api/auth/forgot', async ({ req, body }) => {
  const email = clampStr(body.email, 200).trim().toLowerCase();
  const support = process.env.SUPPORT_EMAIL || '';
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) return { ok: true, manual: true, support };
  const u = await one('select id from users where email=$1', [email]);
  if (u) {
    const token = uid(24);
    await q(`insert into resets(token_hash, user_id, expires_at) values($1,$2, now() + interval '1 hour')`, [sha256(token), u.id]);
    const link = baseUrl(req) + '/#/reset?token=' + token;
    await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: email, subject: 'Reset your Prep Canada password', text: 'Open this link within one hour to choose a new password:\n\n' + link + '\n\nIf you did not ask for this, ignore this email.' })
    }).catch(() => {});
  }
  return { ok: true };
});
route('POST', '/api/auth/reset', async ({ req, res, body }) => {
  const pw = String(body.password || '');
  if (pw.length < 8) throw err(400, 'bad_request', 'Use a password of at least 8 characters.');
  const r = await one('delete from resets where token_hash=$1 and expires_at > now() returning user_id', [sha256(String(body.token || ''))]);
  if (!r) throw err(400, 'bad_token', 'This link has expired. Ask for a new one.');
  await q('update users set pass_hash=$2 where id=$1', [r.user_id, hashPassword(pw)]);
  await q('delete from sessions where user_id=$1', [r.user_id]);
  await newSession(res, req, r.user_id);
  return { ok: true };
});

route('GET', '/api/me', async ({ user }) => {
  if (!user) return { user: null };
  return { user: publicUser(user), entitlements: entitlements(user) };
});
route('POST', '/api/me', async ({ user, body }) => {
  needUser(user);
  if (body.name !== undefined) { const n = clampStr(body.name, 80).trim(); if (n) await q('update users set name=$2 where id=$1', [user.id, n]); }
  if (body.newPassword !== undefined) {
    if (!checkPassword(String(body.password || ''), user.pass_hash)) throw err(400, 'bad_login', 'Your current password is wrong.');
    if (String(body.newPassword).length < 8) throw err(400, 'bad_request', 'Use a password of at least 8 characters.');
    await q('update users set pass_hash=$2 where id=$1', [user.id, hashPassword(String(body.newPassword))]);
  }
  return { user: publicUser(await one('select * from users where id=$1', [user.id])) };
});
route('GET', '/api/me/export', async ({ user, res }) => {
  needUser(user);
  const docs = await q('select exam, key, data, updated_at from docs where user_id=$1', [user.id]);
  const pays = await q('select * from payments where user_id=$1 order by created_at', [user.id]);
  const out = { exportedAt: new Date().toISOString(), account: publicUser(user), documents: docs, payments: pays.map(publicPayment) };
  res.setHeader('content-disposition', 'attachment; filename="prep-canada-data.json"');
  return out;
});
route('DELETE', '/api/me', async ({ user, res, body }) => {
  needUser(user);
  if (!checkPassword(String(body.password || ''), user.pass_hash)) throw err(400, 'bad_login', 'Your password is wrong.');
  // Payment records are kept for accounting, without the account.
  await q('delete from users where id=$1', [user.id]);
  clearSession(res);
  return { ok: true };
});

/* documents: profile, course, lessons, attempts (all JSON saved by the app) */
route('GET', '/api/docs/:exam/:key', async ({ user, params }) => {
  needUser(user); needExam(params.exam);
  if (!KEY_RE.test(params.key)) throw err(400, 'bad_request', 'Bad key.');
  return { data: await getDoc(user.id, params.exam, params.key) };
});
route('PUT', '/api/docs/:exam/:key', async ({ user, params, body }) => {
  needUser(user); needExam(params.exam);
  if (!KEY_RE.test(params.key)) throw err(400, 'bad_request', 'Bad key.');
  const json = JSON.stringify(body.data ?? null);
  if (json.length > 900_000) throw err(413, 'too_large', 'This item is too large to save.');
  await q(`insert into docs(user_id, exam, key, data, updated_at) values($1,$2,$3,$4::jsonb, now())
           on conflict(user_id, exam, key) do update set data=excluded.data, updated_at=now()`, [user.id, params.exam, params.key, json]);
  return { ok: true };
});
route('DELETE', '/api/docs/:exam/:key', async ({ user, params }) => {
  needUser(user); needExam(params.exam);
  await q('delete from docs where user_id=$1 and exam=$2 and key=$3', [user.id, params.exam, params.key]);
  return { ok: true };
});
route('DELETE', '/api/docs/:exam', async ({ user, params }) => {
  needUser(user); needExam(params.exam);
  await q('delete from docs where user_id=$1 and exam=$2', [user.id, params.exam]);
  return { ok: true };
});

/* tests */
route('POST', '/api/attempts/start', async ({ user, body }) => {
  needUser(user); const exam = needExam(body.exam);
  const kind = ['placement', 'mock', 'checkpoint'].includes(body.kind) ? body.kind : 'mock';
  const sections = toArr(body.sections).filter((s) => SECTIONS.includes(s));
  if (!sections.length) throw err(400, 'bad_request', 'Choose at least one section.');
  const diff = ['auto', 'foundation', 'exam', 'advanced'].includes(body.diff) ? body.diff : 'exam';
  await checkCanStart(user, exam, kind);
  const id = 'a' + uid(9);
  await q('insert into attempts(id, user_id, exam, kind, sections, diff) values($1,$2,$3,$4,$5,$6)', [id, user.id, exam, kind, [...new Set(sections)].join(','), diff]);
  return { id };
});

const JOBS = { L: 4, R: 3, W: 1, S: 1 };
const TEF_JOBS = { L: 4, R: 4, W: 1, S: 1 };
route('POST', '/api/ai', async ({ user, body }) => {
  needUser(user); const exam = needExam(body.exam);
  const pr = P[exam];
  const paid = isPaidFor(user, exam);
  await bumpUsage(user.id, 'ai_calls', paid ? LIMITS.paid.aiPerDay : LIMITS.free.aiPerDay);
  const profile = (await getDoc(user.id, exam, 'profile')) || {};
  const task = body.task;

  if (task === 'gen') {
    const att = await getAttempt(user, exam, body.attemptId);
    const k = body.k, i = Number(body.i);
    const jobs = (exam === 'tef' ? TEF_JOBS : JOBS)[k];
    if (!att.sectionList.includes(k) || !(i >= 0 && i < jobs)) throw err(400, 'bad_request', 'Unknown part.');
    if (Date.now() - new Date(att.created_at) > 3 * 86400000) throw err(410, 'expired', 'This test is too old to continue. Start a new one.');
    const total = att.sectionList.reduce((s, x) => s + (exam === 'tef' ? TEF_JOBS : JOBS)[x], 0);
    const r = await one('update attempts set gen_calls=gen_calls+1 where id=$1 returning gen_calls', [att.id]);
    if (r.gen_calls > total * 3) throw err(429, 'daily_limit', 'Too many retries for this test. Start a new one.');
    const g = pr.genPrompt(att, profile, user, k, i);
    return aiJSON(g.prompt, { fast: g.fast, task: exam + ':gen:' + k });
  }
  if (task === 'markW' || task === 'markS') {
    const att = await getAttempt(user, exam, body.attemptId);
    const k = task === 'markW' ? 'W' : 'S';
    if (!att.sectionList.includes(k)) throw err(400, 'bad_request', 'This test has no such section.');
    const r = await one('update attempts set mark_calls=mark_calls+1 where id=$1 returning mark_calls', [att.id]);
    if (r.mark_calls > 10) throw err(429, 'daily_limit', 'Too many marking attempts for this test.');
    const doc = await getDoc(user.id, exam, 'attempt_' + att.id);
    if (!doc || !doc.content || !doc.content[k] || !doc.content[k][0]) throw err(409, 'not_saved', 'Your answers are not saved yet. Try again in a moment.');
    const prompt = task === 'markW' ? pr.markWritingPrompt(doc, profile, user) : pr.markSpeakingPrompt(doc, profile, user);
    return aiJSON(prompt, { task: exam + ':' + task });
  }
  if (task === 'examiner') {
    if (exam !== 'tef') throw err(400, 'bad_request', 'Unknown task.');
    const att = await getAttempt(user, exam, body.attemptId);
    const sec = body.sec === 'B' ? 'B' : 'A';
    const r = await one('update attempts set turns=turns+1 where id=$1 returning turns', [att.id]);
    if (r.turns > 90) throw err(429, 'daily_limit', 'This speaking test has reached its limit of exchanges.');
    const doc = await getDoc(user.id, exam, 'attempt_' + att.id);
    if (!doc || !doc.content || !doc.content.S) throw err(409, 'not_saved', 'Your test is not saved yet.');
    const log = toArr(doc.answers && doc.answers.S && doc.answers.S[sec]).slice(-40).map((m) => ({ role: m.role === 'ex' ? 'examiner' : 'candidate', text: clampStr(m.text, 1500) }));
    const reply = await aiChat(TEF.examinerRules(doc, sec), log);
    return { text: reply };
  }
  if (task === 'course') {
    requirePaid(user, exam, 'The personal course');
    return aiJSON(pr.coursePrompt(profile, user), { task: exam + ':course' });
  }
  if (task === 'lesson' || task === 'taskfb') {
    requirePaid(user, exam, 'Lessons');
    const course = await getDoc(user.id, exam, 'course');
    const unit = course && toArr(course.phases).flatMap((ph) => toArr(ph.units)).find((u) => u.id === body.unitId);
    if (!unit) throw err(404, 'not_found', 'Unit not found. Rebuild your course.');
    if (task === 'lesson') return aiJSON(pr.lessonPrompt(profile, user, unit), { task: exam + ':lesson' });
    const lesson = await getDoc(user.id, exam, 'lesson_' + clampStr(course.version, 40) + '_' + unit.id);
    const taskPrompt = lesson && lesson.task ? lesson.task.prompt : unit.title;
    const answer = clampStr(body.answer, 6000);
    if (words(answer) < 10) throw err(400, 'bad_request', 'Write a little more first.');
    return aiJSON(pr.taskFbPrompt(profile, user, unit, taskPrompt, answer), { task: exam + ':taskfb' });
  }
  if (task === 'real' && exam === 'ielts') {
    return aiJSON(IELTS.realExplainPrompt(body.wrong, body.transcript), { task: 'ielts:real' });
  }
  throw err(400, 'bad_request', 'Unknown task.');
});

/* natural voices (paid plans) */
async function audioPlan(user, q0) {
  const exam = needExam(q0.exam);
  requirePaid(user, exam, 'Natural voices');
  const att = await getAttempt(user, exam, q0.attemptId);
  const doc = await getDoc(user.id, exam, 'attempt_' + att.id);
  if (!doc) throw err(409, 'not_saved', 'Test not saved yet.');
  const plan = exam === 'ielts' ? IELTS.listeningAudioPlan(doc, Number(q0.part)) : TEF.listeningAudioPlan(doc, Number(q0.part), Number(q0.doc || 0));
  if (!plan) throw err(404, 'not_found', 'This recording is not ready yet.');
  return plan;
}
route('POST', '/api/tts/plan', async ({ user, body }) => {
  needUser(user);
  const plan = await audioPlan(user, body);
  return { chunks: plan.chunks.map((c) => ({ kind: c.kind })) };
});
route('GET', '/api/tts/chunk', async ({ user, query, res }) => {
  needUser(user);
  const plan = await audioPlan(user, query);
  const c = plan.chunks[Number(query.c)];
  if (!c) throw err(404, 'not_found', 'No such chunk.');
  await bumpUsage(user.id, 'tts_calls', LIMITS.paid.ttsPerDay);
  const wav = await tts(c.lines, plan.voices, plan.style);
  send(res, 200, wav, { 'content-type': 'audio/wav', 'cache-control': 'private, max-age=86400' });
  return undefined;
});
route('POST', '/api/tts/say', async ({ user, body, res }) => {
  needUser(user); const exam = needExam(body.exam);
  requirePaid(user, exam, 'Natural voices');
  const text = clampStr(body.text, 600).trim();
  if (!text) throw err(400, 'bad_request', 'Nothing to say.');
  await bumpUsage(user.id, 'tts_calls', LIMITS.paid.ttsPerDay);
  const voice = exam === 'ielts' ? 'Kore' : (body.role === 'friend' ? 'Puck' : 'Aoede');
  const style = exam === 'ielts' ? 'Say this as a friendly IELTS speaking examiner with a native British English accent' : 'Dis ceci naturellement, à l’oral, avec un accent français natif';
  const wav = await tts([{ speaker: 'Voice', text }], { Voice: voice }, style);
  send(res, 200, wav, { 'content-type': 'audio/wav' });
  return undefined;
});

/* billing */
route('POST', '/api/billing/checkout', async ({ user, body, req }) => {
  needUser(user);
  return checkout(user, body, baseUrl(req));
});
route('GET', '/api/billing/verify', async ({ user, query }) => {
  needUser(user);
  const p = await one('select * from payments where id=$1 and user_id=$2', [String(query.id || ''), user.id]);
  if (!p) throw err(404, 'not_found', 'Payment not found.');
  const v = await verify(p.id);
  const u = await one('select * from users where id=$1', [user.id]);
  return { payment: publicPayment(v), plan: activePlan(u) };
});
route('GET', '/api/billing/payments', async ({ user }) => {
  needUser(user);
  const rows = await q('select * from payments where user_id=$1 order by created_at desc limit 50', [user.id]);
  return { payments: rows.map(publicPayment) };
});
route('GET', '/api/billing/konnect-webhook', async ({ query }) => {
  const p = await byProviderRef(query.payment_ref);
  if (p) await verify(p.id);
  return { ok: true };
});
const flouciHook = async ({ query, body }) => {
  const pid = query.pid || (body && body.developer_tracking_id);
  if (pid) { const p = await one('select id from payments where id=$1', [String(pid)]); if (p) await verify(p.id); }
  return { ok: true };
};
route('GET', '/api/billing/flouci-webhook', flouciHook);
route('POST', '/api/billing/flouci-webhook', flouciHook);
route('GET', '/api/billing/mock-pay', async ({ query, res, req }) => {
  if (process.env.PAYMENTS_MOCK !== '1') throw err(404, 'not_found', 'Not found.');
  await markPaid(String(query.pid || ''), 'mock');
  redirect(res, baseUrl(req) + '/#/billing/return?pid=' + encodeURIComponent(query.pid || ''));
  return undefined;
});

/* admin */
route('GET', '/api/admin/stats', async ({ user }) => {
  needAdmin(user);
  const users = await one('select count(*)::int as n from users');
  const active = await q(`select plan, count(*)::int as n from users where plan<>'free' and plan_until > now() group by plan`);
  const month = await one(`select coalesce(sum(amount_millimes),0)::int as m, count(*)::int as n from payments where status='paid' and paid_at >= date_trunc('month', now())`);
  const review = await one(`select count(*)::int as n from payments where status='review'`);
  const tests = await one(`select count(*)::int as n from attempts where created_at > now() - interval '7 days'`);
  return { users: users.n, active, revenueMonth: month.m / 1000, paymentsMonth: month.n, toReview: review.n, testsWeek: tests.n };
});
route('GET', '/api/admin/payments', async ({ user, query }) => {
  needAdmin(user);
  const st = query.status || 'review';
  const rows = await q(`select * from payments where ($1='all' or status=$1) order by created_at desc limit 100`, [st]);
  return { payments: rows.map((p) => ({ ...publicPayment(p), email: p.email, userId: p.user_id, note: p.note })) };
});
route('POST', '/api/admin/payments/:id/:action', async ({ user, params }) => {
  needAdmin(user);
  if (params.action === 'approve') { await markPaid(params.id, 'approved by ' + user.email); return { ok: true }; }
  if (params.action === 'reject') { await q(`update payments set status='rejected', note=$2 where id=$1 and status<>'paid'`, [params.id, 'rejected by ' + user.email]); return { ok: true }; }
  throw err(400, 'bad_request', 'Unknown action.');
});
route('GET', '/api/admin/users', async ({ user, query }) => {
  needAdmin(user);
  const s = '%' + clampStr(query.q, 100).toLowerCase() + '%';
  const rows = await q(`select id, email, name, created_at, plan, plan_exam, plan_until, disabled from users where lower(email) like $1 or lower(name) like $1 order by created_at desc limit 50`, [s]);
  return { users: rows.map((u) => ({ ...u, active: activePlan(u) })) };
});
route('POST', '/api/admin/users/:id/plan', async ({ user, params, body }) => {
  needAdmin(user);
  if (body.plan === 'free') { await q(`update users set plan='free', plan_exam=null, plan_until=null where id=$1`, [params.id]); return { ok: true }; }
  if (!['solo', 'duo'].includes(body.plan)) throw err(400, 'bad_request', 'Unknown plan.');
  const days = Math.max(1, Math.min(800, Number(body.days) || 30));
  const until = new Date(Date.now() + days * 86400000).toISOString();
  await q('update users set plan=$2, plan_exam=$3, plan_until=$4 where id=$1', [params.id, body.plan, body.plan === 'solo' ? (EXAMS.includes(body.exam) ? body.exam : 'ielts') : null, until]);
  return { ok: true };
});
route('POST', '/api/admin/users/:id/reset-password', async ({ user, params }) => {
  needAdmin(user);
  const temp = uid(6);
  await q('update users set pass_hash=$2 where id=$1', [params.id, hashPassword(temp)]);
  await q('delete from sessions where user_id=$1', [params.id]);
  return { tempPassword: temp };
});
route('POST', '/api/admin/users/:id/disable', async ({ user, params, body }) => {
  needAdmin(user);
  await q('update users set disabled=$2 where id=$1', [params.id, !!body.disabled]);
  if (body.disabled) await q('delete from sessions where user_id=$1', [params.id]);
  return { ok: true };
});

/* ---------------- entry ---------------- */
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  let path = url.pathname.replace(/\/+$/, '');
  if (path === '/api/index' && url.searchParams.get('path')) path = '/api/' + url.searchParams.get('path');
  const query = Object.fromEntries(url.searchParams.entries());
  try {
    const method = req.method.toUpperCase();
    if (method !== 'GET' && !path.includes('webhook') && req.headers['x-requested-with'] !== 'prep-canada') {
      throw err(403, 'forbidden', 'Missing request header.');
    }
    let match = null, params = {};
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(path);
      if (m) { match = r; params = m.groups || {}; break; }
    }
    if (!match) throw err(404, 'not_found', 'Not found.');
    const body = method === 'GET' ? {} : await readBody(req);
    const user = await currentUser(req);
    const out = await match.fn({ req, res, body, query, params, user });
    if (out !== undefined && !res.writableEnded) send(res, 200, out);
  } catch (e) {
    if (res.writableEnded) return;
    if (e instanceof HttpError) return send(res, e.status, { error: { code: e.code, message: e.message, ...(e.extra || {}) } });
    console.error(e);
    send(res, 500, { error: { code: 'server_error', message: 'Something went wrong on our side. Try again.' } });
  }
}
