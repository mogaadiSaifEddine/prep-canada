// HTTP API: one handler for every /api/* route. Next.js calls it from app/api/[...path]/route.ts
// with a Web Request and gets a Web Response back.
import { q, one, type Row } from './db';
import { err, HttpError, uid, sha256, hashPassword, checkPassword, parseCookies, clampStr, toArr, baseUrl, words } from './util';
import { activePlan, entitlements, isPaidFor, checkCanStart, requirePaid, bumpUsage, LIMITS, prices, EXAMS, sectionsThisMonth, type Exam } from './plans';
import { aiJSON, aiChat, isMock } from './ai';
import { contentFor, generateItem, lessonFor, lessonCatalog, report as poolReport, poolStats } from './pool';
import { cachedSpeech, audioStats } from './audio';
import { checkout, verify, markPaid, byProviderRef, publicPayment, methods, manualInfo } from './payments';
import { currentDraws, saveManual, clearManual, BUNDLED } from './draws';
import * as IELTS from './prompts/ielts';
import * as TEF from './prompts/tef';

const P = { ielts: IELTS, tef: TEF } as const;
const COOKIE = 'pc_sess';
const SESSION_DAYS = 60;
const KEY_RE = /^[A-Za-z0-9_.-]{1,120}$/;
const SECTIONS = ['L', 'R', 'W', 'S'];
const MAX_BODY = 1_500_000;

type Ctx = {
  req: Request;
  body: any;
  query: Record<string, string>;
  params: Record<string, string>;
  user: Row | null;
  /** Extra response headers (cookies, content-disposition) added to a JSON reply. */
  headers: Headers;
};
type Handler = (c: Ctx) => Promise<unknown>;

/* ---------------- plumbing ---------------- */
function json(status: number, body: unknown, headers?: Headers | Record<string, string>) {
  const h = new Headers(headers);
  h.set('content-type', 'application/json; charset=utf-8');
  if (!h.has('cache-control')) h.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers: h });
}
function binary(bytes: Buffer, headers: Record<string, string>) {
  const h = new Headers(headers);
  if (!h.has('cache-control')) h.set('cache-control', 'no-store');
  return new Response(new Uint8Array(bytes), { status: 200, headers: h });
}
async function readBody(req: Request) {
  const text = await req.text();
  if (text.length > MAX_BODY) throw err(413, 'too_large', 'Request too large.');
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw err(400, 'bad_json', 'Invalid JSON.'); }
}
const isSecure = (req: Request) => (req.headers.get('x-forwarded-proto') || '').includes('https') || req.url.startsWith('https:') || process.env.NODE_ENV === 'production';
function setSession(c: Ctx, token: string) {
  c.headers.append('set-cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${isSecure(c.req) ? '; Secure' : ''}`);
}
function clearSession(c: Ctx) { c.headers.append('set-cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`); }
async function newSession(c: Ctx, userId: string) {
  const token = uid(32);
  await q(`insert into sessions(token_hash, user_id, expires_at) values($1,$2, now() + interval '${SESSION_DAYS} days')`, [sha256(token), userId]);
  setSession(c, token);
}
async function currentUser(req: Request) {
  const token = parseCookies(req.headers.get('cookie'))[COOKIE];
  if (!token) return null;
  return one(`select u.* from sessions s join users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at > now() and not u.disabled`, [sha256(token)]);
}
const isAdmin = (u: Row | null) => !!u && String(process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean).includes(u.email);
function needUser(u: Row | null): Row { if (!u) throw err(401, 'unauthorized', 'Please sign in.'); return u; }
function needAdmin(u: Row | null): Row { needUser(u); if (!isAdmin(u)) throw err(403, 'forbidden', 'Admins only.'); return u as Row; }
function needExam(ex: unknown): Exam { if (!EXAMS.includes(ex as Exam)) throw err(400, 'bad_request', 'Unknown exam.'); return ex as Exam; }
function needNs(ns: string) { if (!EXAMS.includes(ns as Exam) && ns !== 'journey') throw err(400, 'bad_request', 'Unknown section.'); return ns; }

function publicUser(u: Row) {
  return { id: u.id, email: u.email, name: u.name, lang: u.lang || null, createdAt: u.created_at, plan: activePlan(u), isAdmin: isAdmin(u) };
}
async function getDoc(userId: string, exam: string, key: string) {
  const r = await one('select data from docs where user_id=$1 and exam=$2 and key=$3', [userId, exam, key]);
  return r ? r.data : null;
}
async function getAttempt(u: Row, exam: string, id: unknown) {
  const a = await one('select * from attempts where id=$1 and user_id=$2 and exam=$3', [String(id || ''), u.id, exam]);
  if (!a) throw err(404, 'not_found', 'Test not found.');
  a.sectionList = String(a.sections).split(',');
  return a;
}

/* ---------------- routes ---------------- */
const routes: { method: string; re: RegExp; fn: Handler }[] = [];
const route = (method: string, path: string, fn: Handler) => routes.push({ method, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

route('GET', '/api/health', async () => {
  const missing = ['DATABASE_URL', 'OPENROUTER_API_KEY', 'ADMIN_EMAILS'].filter((k) => !process.env[k] && !(k === 'OPENROUTER_API_KEY' && isMock()));
  let db = false;
  if (process.env.DATABASE_URL) { try { await q('select 1'); db = true; } catch (e) { console.error('DB check failed', (e as Error).message); } }
  return { ok: !missing.length && db, missing, db };
});

route('GET', '/api/config', async () => ({
  prices: prices(), methods: methods(), manualInfo: manualInfo(),
  support: process.env.SUPPORT_EMAIL || '', business: process.env.BUSINESS_NAME || '', matricule: process.env.MATRICULE_FISCAL || '',
  inpdp: process.env.INPDP_DECLARATION || '', limits: LIMITS
}));

route('POST', '/api/auth/signup', async (c) => {
  const { body } = c;
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
  const lang = ['en', 'fr', 'ar'].includes(body.lang) ? body.lang : null;
  await q('insert into users(id, email, pass_hash, name, consent_at, lang) values($1,$2,$3,$4, now(), $5)', [id, email, hashPassword(pw), name, lang]);
  await newSession(c, id);
  return { user: publicUser((await one('select * from users where id=$1', [id]))!) };
});

const failed = new Map<string, { n: number; t: number }>();
route('POST', '/api/auth/login', async (c) => {
  const email = clampStr(c.body.email, 200).trim().toLowerCase();
  const f = failed.get(email) || { n: 0, t: 0 };
  if (f.n >= 8 && Date.now() - f.t < 15 * 60000) throw err(429, 'rate_limited', 'Too many attempts. Wait 15 minutes, then try again.');
  const u = await one('select * from users where email=$1 and not disabled', [email]);
  if (!u || !checkPassword(String(c.body.password || ''), u.pass_hash)) {
    failed.set(email, { n: f.n + 1, t: Date.now() });
    await new Promise((r) => setTimeout(r, 400));
    throw err(401, 'bad_login', 'Wrong email or password.');
  }
  failed.delete(email);
  await newSession(c, u.id);
  return { user: publicUser(u) };
});

route('POST', '/api/auth/logout', async (c) => {
  const token = parseCookies(c.req.headers.get('cookie'))[COOKIE];
  if (token) await q('delete from sessions where token_hash=$1', [sha256(token)]);
  clearSession(c);
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
    const link = baseUrl(req) + '/reset?token=' + token;
    await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: email, subject: 'Reset your Prep Canada password', text: 'Open this link within one hour to choose a new password:\n\n' + link + '\n\nIf you did not ask for this, ignore this email.' })
    }).catch(() => {});
  }
  return { ok: true };
});
route('POST', '/api/auth/reset', async (c) => {
  const pw = String(c.body.password || '');
  if (pw.length < 8) throw err(400, 'bad_request', 'Use a password of at least 8 characters.');
  const r = await one('delete from resets where token_hash=$1 and expires_at > now() returning user_id', [sha256(String(c.body.token || ''))]);
  if (!r) throw err(400, 'bad_token', 'This link has expired. Ask for a new one.');
  await q('update users set pass_hash=$2 where id=$1', [r.user_id, hashPassword(pw)]);
  await q('delete from sessions where user_id=$1', [r.user_id]);
  await newSession(c, r.user_id);
  return { ok: true };
});

route('GET', '/api/me', async ({ user }) => {
  if (!user) return { user: null };
  return { user: publicUser(user), entitlements: entitlements(user) };
});
route('POST', '/api/me', async ({ user: u, body }) => {
  const user = needUser(u);
  if (body.name !== undefined) { const n = clampStr(body.name, 80).trim(); if (n) await q('update users set name=$2 where id=$1', [user.id, n]); }
  if (body.lang !== undefined && ['en', 'fr', 'ar'].includes(body.lang)) await q('update users set lang=$2 where id=$1', [user.id, body.lang]);
  if (body.newPassword !== undefined) {
    if (!checkPassword(String(body.password || ''), user.pass_hash)) throw err(400, 'bad_login', 'Your current password is wrong.');
    if (String(body.newPassword).length < 8) throw err(400, 'bad_request', 'Use a password of at least 8 characters.');
    await q('update users set pass_hash=$2 where id=$1', [user.id, hashPassword(String(body.newPassword))]);
  }
  return { user: publicUser((await one('select * from users where id=$1', [user.id]))!) };
});
route('GET', '/api/me/export', async ({ user: u, headers }) => {
  const user = needUser(u);
  const docs = await q('select exam, key, data, updated_at from docs where user_id=$1', [user.id]);
  const pays = await q('select * from payments where user_id=$1 order by created_at', [user.id]);
  headers.set('content-disposition', 'attachment; filename="prep-canada-data.json"');
  return { exportedAt: new Date().toISOString(), account: publicUser(user), documents: docs, payments: pays.map(publicPayment) };
});
route('DELETE', '/api/me', async (c) => {
  const user = needUser(c.user);
  if (!checkPassword(String(c.body.password || ''), user.pass_hash)) throw err(400, 'bad_login', 'Your password is wrong.');
  // Payment records are kept for accounting, without the account.
  await q('delete from users where id=$1', [user.id]);
  clearSession(c);
  return { ok: true };
});

/* documents: profile, course, lessons, attempts, journey (all JSON saved by the app) */
route('GET', '/api/docs/:exam/:key', async ({ user: u, params }) => {
  const user = needUser(u); needNs(params.exam);
  if (!KEY_RE.test(params.key)) throw err(400, 'bad_request', 'Bad key.');
  return { data: await getDoc(user.id, params.exam, params.key) };
});
route('PUT', '/api/docs/:exam/:key', async ({ user: u, params, body }) => {
  const user = needUser(u); needNs(params.exam);
  if (!KEY_RE.test(params.key)) throw err(400, 'bad_request', 'Bad key.');
  const data = JSON.stringify(body.data ?? null);
  if (data.length > 900_000) throw err(413, 'too_large', 'This item is too large to save.');
  await q(`insert into docs(user_id, exam, key, data, updated_at) values($1,$2,$3,$4::text::jsonb, now())
           on conflict(user_id, exam, key) do update set data=excluded.data, updated_at=now()`, [user.id, params.exam, params.key, data]);
  return { ok: true };
});
route('DELETE', '/api/docs/:exam/:key', async ({ user: u, params }) => {
  const user = needUser(u); needNs(params.exam);
  await q('delete from docs where user_id=$1 and exam=$2 and key=$3', [user.id, params.exam, params.key]);
  return { ok: true };
});
route('DELETE', '/api/docs/:exam', async ({ user: u, params }) => {
  const user = needUser(u); needNs(params.exam);
  await q('delete from docs where user_id=$1 and exam=$2', [user.id, params.exam]);
  return { ok: true };
});

/* tests */
route('POST', '/api/attempts/start', async ({ user: u, body }) => {
  const user = needUser(u); const exam = needExam(body.exam);
  const kind = ['placement', 'mock', 'checkpoint'].includes(body.kind) ? body.kind : 'mock';
  const sections = [...new Set(toArr<string>(body.sections).filter((s) => SECTIONS.includes(s)))];
  if (!sections.length) throw err(400, 'bad_request', 'Choose at least one section.');
  const diff = ['auto', 'foundation', 'exam', 'advanced'].includes(body.diff) ? body.diff : 'exam';
  await checkCanStart(user, exam, kind, sections.length);
  const id = 'a' + uid(9);
  await q('insert into attempts(id, user_id, exam, kind, sections, diff) values($1,$2,$3,$4,$5,$6)', [id, user.id, exam, kind, sections.join(','), diff]);
  return { id };
});

const JOBS: Record<string, number> = { L: 4, R: 3, W: 1, S: 1 };
const TEF_JOBS: Record<string, number> = { L: 4, R: 4, W: 1, S: 1 };
route('POST', '/api/ai', async ({ user: u, body }) => {
  const user = needUser(u); const exam = needExam(body.exam);
  const pr = P[exam];
  const paid = isPaidFor(user, exam);
  await bumpUsage(user.id, 'ai_calls', paid ? LIMITS.paid.aiPerDay : LIMITS.free.aiPerDay);
  const profile = (await getDoc(user.id, exam, 'profile')) || {};
  const task = body.task;

  if (task === 'gen') {
    const att = await getAttempt(user, exam, body.attemptId);
    const k = String(body.k), i = Number(body.i);
    const jobsMap = exam === 'tef' ? TEF_JOBS : JOBS;
    const jobs = jobsMap[k];
    if (!att.sectionList.includes(k) || !(i >= 0 && i < jobs)) throw err(400, 'bad_request', 'Unknown part.');
    if (Date.now() - new Date(att.created_at).getTime() > 3 * 86400000) throw err(410, 'expired', 'This test is too old to continue. Start a new one.');
    const total = att.sectionList.reduce((s: number, x: string) => s + jobsMap[x], 0);
    const r = await one('update attempts set gen_calls=gen_calls+1 where id=$1 returning gen_calls', [att.id]);
    if (r!.gen_calls > total * 3) throw err(429, 'daily_limit', 'Too many retries for this test. Start a new one.');
    return contentFor(pr, { exam, k, i, att, profile, user });
  }
  if (task === 'markW' || task === 'markS') {
    const att = await getAttempt(user, exam, body.attemptId);
    const k = task === 'markW' ? 'W' : 'S';
    if (!att.sectionList.includes(k)) throw err(400, 'bad_request', 'This test has no such section.');
    const r = await one('update attempts set mark_calls=mark_calls+1 where id=$1 returning mark_calls', [att.id]);
    if (r!.mark_calls > 10) throw err(429, 'daily_limit', 'Too many marking attempts for this test.');
    const doc = await getDoc(user.id, exam, 'attempt_' + att.id);
    if (!doc || !doc.content || !doc.content[k] || !doc.content[k][0]) throw err(409, 'not_saved', 'Your answers are not saved yet. Try again in a moment.');
    const prompt = task === 'markW' ? pr.markWritingPrompt(doc, profile, user) : pr.markSpeakingPrompt(doc, profile, user);
    return aiJSON(prompt, { task: exam + ':' + task, meta: { userId: user.id, exam } });
  }
  if (task === 'examiner') {
    if (exam !== 'tef') throw err(400, 'bad_request', 'Unknown task.');
    const att = await getAttempt(user, exam, body.attemptId);
    const sec = body.sec === 'B' ? 'B' : 'A';
    const r = await one('update attempts set turns=turns+1 where id=$1 returning turns', [att.id]);
    if (r!.turns > 90) throw err(429, 'daily_limit', 'This speaking test has reached its limit of exchanges.');
    const doc = await getDoc(user.id, exam, 'attempt_' + att.id);
    if (!doc || !doc.content || !doc.content.S) throw err(409, 'not_saved', 'Your test is not saved yet.');
    const log = toArr<any>(doc.answers && doc.answers.S && doc.answers.S[sec]).slice(-40).map((m) => ({ role: m.role === 'ex' ? 'examiner' : 'candidate', text: clampStr(m.text, 1500) }));
    const reply = await aiChat(TEF.examinerRules(doc, sec), log, { userId: user.id, exam });
    return { text: reply };
  }
  if (task === 'course') {
    requirePaid(user, exam, 'The personal course');
    const catalog = await lessonCatalog(exam);
    const prev = await getDoc(user.id, exam, 'course');
    return aiJSON(pr.coursePrompt(profile, user, catalog, prev),{ task: exam + ':course', meta: { userId: user.id, exam } });
  }
  if (task === 'lesson' || task === 'taskfb') {
    requirePaid(user, exam, 'Lessons');
    const course = await getDoc(user.id, exam, 'course');
    const unit = course && toArr<any>(course.phases).flatMap((ph) => toArr<any>(ph.units)).find((x) => x.id === body.unitId);
    if (!unit) throw err(404, 'not_found', 'Unit not found. Rebuild your course.');
    if (task === 'lesson') return lessonFor(pr, { exam, unit, profile, user });
    // A unit kept from an earlier course keeps its saved lesson (lessonKey).
    const lk = typeof unit.lessonKey === 'string' && KEY_RE.test('lesson_' + unit.lessonKey) ? unit.lessonKey : clampStr(course.version, 40) + '_' + unit.id;
    const lesson = await getDoc(user.id, exam, 'lesson_' + lk);
    const taskPrompt = lesson && lesson.task ? lesson.task.prompt : unit.title;
    const answer = clampStr(body.answer, 6000);
    if (words(answer) < 10) throw err(400, 'bad_request', 'Write a little more first.');
    return aiJSON(pr.taskFbPrompt(profile, user, unit, taskPrompt, answer), { task: exam + ':taskfb', fast: true, think: 'low', meta: { userId: user.id, exam } });
  }
  if (task === 'real' && exam === 'ielts') {
    return aiJSON(IELTS.realExplainPrompt(body.wrong, body.transcript), { task: 'ielts:real', fast: true, meta: { userId: user.id, exam } });
  }
  throw err(400, 'bad_request', 'Unknown task.');
});

/* natural voices (paid plans) */
async function audioPlan(user: Row, q0: Record<string, any>) {
  const exam = needExam(q0.exam);
  requirePaid(user, exam, 'Natural voices');
  const att = await getAttempt(user, exam, q0.attemptId);
  const doc = await getDoc(user.id, exam, 'attempt_' + att.id);
  if (!doc) throw err(409, 'not_saved', 'Test not saved yet.');
  const plan = exam === 'ielts' ? IELTS.listeningAudioPlan(doc, Number(q0.part)) : TEF.listeningAudioPlan(doc, Number(q0.part), Number(q0.doc || 0));
  if (!plan) throw err(404, 'not_found', 'This recording is not ready yet.');
  return plan;
}
route('POST', '/api/tts/plan', async ({ user: u, body }) => {
  const user = needUser(u);
  const plan = await audioPlan(user, body);
  return { chunks: plan.chunks.map((c) => ({ kind: c.kind })) };
});
route('GET', '/api/tts/chunk', async ({ user: u, query, req }) => {
  const user = needUser(u);
  const plan = await audioPlan(user, query);
  const c = plan.chunks[Number(query.c)];
  if (!c) throw err(404, 'not_found', 'No such chunk.');
  const out = await cachedSpeech(c.lines, plan.voices, plan.style, { userId: user.id, exam: query.exam });
  if (!out.cached) await bumpUsage(user.id, 'tts_calls', LIMITS.paid.ttsPerDay);
  if (req.headers.get('if-none-match') === '"' + out.key + '"') return new Response(null, { status: 304 });
  return binary(out.bytes, { 'content-type': out.mime, 'cache-control': 'private, max-age=31536000, immutable', etag: '"' + out.key + '"', 'x-cache': out.cached ? 'HIT' : 'MISS' });
});
route('POST', '/api/tts/say', async ({ user: u, body }) => {
  const user = needUser(u); const exam = needExam(body.exam);
  requirePaid(user, exam, 'Natural voices');
  const text = clampStr(body.text, 600).trim();
  if (!text) throw err(400, 'bad_request', 'Nothing to say.');
  const voice = exam === 'ielts' ? 'Kore' : (body.role === 'friend' ? 'Puck' : 'Aoede');
  const style = exam === 'ielts' ? 'Say this as a friendly IELTS speaking examiner with a native British English accent' : 'Dis ceci naturellement, à l’oral, avec un accent français natif';
  const out = await cachedSpeech([{ speaker: 'Voice', text }], { Voice: voice }, style, { userId: user.id, exam });
  if (!out.cached) await bumpUsage(user.id, 'tts_calls', LIMITS.paid.ttsPerDay);
  return binary(out.bytes, { 'content-type': out.mime, 'x-cache': out.cached ? 'HIT' : 'MISS' });
});

/* usage and quality */
route('GET', '/api/usage/:exam', async ({ user: u, params }) => {
  const user = needUser(u); const exam = needExam(params.exam);
  const paid = isPaidFor(user, exam);
  return { paid, sectionsUsed: await sectionsThisMonth(user.id, exam), sectionsLimit: paid ? LIMITS.paid.sectionsPerMonth : null };
});
route('POST', '/api/pool/report', async ({ user: u, body }) => {
  const user = needUser(u); const exam = needExam(body.exam);
  const att = await getAttempt(user, exam, body.attemptId);
  const doc = await getDoc(user.id, exam, 'attempt_' + att.id);
  const part = doc && doc.content && doc.content[body.k] && doc.content[body.k][Number(body.i)];
  if (!part || !part._pool) return { ok: true, pooled: false };
  return poolReport(user.id, String(part._pool), body.reason);
});

/* billing */
route('POST', '/api/billing/checkout', async ({ user: u, body, req }) => checkout(needUser(u), body, baseUrl(req)));
route('GET', '/api/billing/verify', async ({ user: u, query }) => {
  const user = needUser(u);
  const p = await one('select * from payments where id=$1 and user_id=$2', [String(query.id || ''), user.id]);
  if (!p) throw err(404, 'not_found', 'Payment not found.');
  const v = await verify(p.id);
  const fresh = await one('select * from users where id=$1', [user.id]);
  return { payment: publicPayment(v!), plan: activePlan(fresh) };
});
route('GET', '/api/billing/payments', async ({ user: u }) => {
  const user = needUser(u);
  const rows = await q('select * from payments where user_id=$1 order by created_at desc limit 50', [user.id]);
  return { payments: rows.map(publicPayment) };
});
route('GET', '/api/billing/konnect-webhook', async ({ query }) => {
  const p = await byProviderRef(query.payment_ref);
  if (p) await verify(p.id);
  return { ok: true };
});
const flouciHook: Handler = async ({ query, body }) => {
  const pid = query.pid || (body && body.developer_tracking_id);
  if (pid) { const p = await one('select id from payments where id=$1', [String(pid)]); if (p) await verify(p.id); }
  return { ok: true };
};
route('GET', '/api/billing/flouci-webhook', flouciHook);
route('POST', '/api/billing/flouci-webhook', flouciHook);
route('GET', '/api/billing/mock-pay', async ({ query, req }) => {
  if (process.env.PAYMENTS_MOCK !== '1') throw err(404, 'not_found', 'Not found.');
  await markPaid(String(query.pid || ''), 'mock');
  return new Response(null, { status: 302, headers: { location: baseUrl(req) + '/billing/return?pid=' + encodeURIComponent(query.pid || '') } });
});

/* ---------------- invitation rounds (public) ---------------- */
route('GET', '/api/draws', async () => json(200, await currentDraws(), { 'cache-control': 'public, max-age=600, s-maxage=1800, stale-while-revalidate=86400' }));

/* admin */
route('GET', '/api/admin/draws', async ({ user }) => { needAdmin(user); const d = await currentDraws(); return { current: d, bundled: BUNDLED }; });
route('PUT', '/api/admin/draws', async ({ user, body }) => { needAdmin(user); const saved = await saveManual(body); return { ok: true, saved }; });
route('DELETE', '/api/admin/draws', async ({ user }) => { needAdmin(user); await clearManual(); return { ok: true }; });
route('POST', '/api/admin/draws/refresh', async ({ user }) => { needAdmin(user); const d = await currentDraws({ force: true }); return { ok: true, live: d.live, latest: d.ee.rounds[0] }; });

route('GET', '/api/admin/stats', async ({ user }) => {
  needAdmin(user);
  const users = await one('select count(*)::int as n from users');
  const active = await q(`select plan, count(*)::int as n from users where plan<>'free' and plan_until > now() group by plan`);
  const month = await one(`select coalesce(sum(amount_millimes),0)::int as m, count(*)::int as n from payments where status='paid' and paid_at >= date_trunc('month', now())`);
  const review = await one(`select count(*)::int as n from payments where status='review'`);
  const tests = await one(`select count(*)::int as n from attempts where created_at > now() - interval '7 days'`);
  return { users: users!.n, active, revenueMonth: month!.m / 1000, paymentsMonth: month!.n, toReview: review!.n, testsWeek: tests!.n };
});
route('GET', '/api/admin/payments', async ({ user, query }) => {
  needAdmin(user);
  const st = query.status || 'review';
  const rows = await q(`select * from payments where ($1='all' or status=$1) order by created_at desc limit 100`, [st]);
  return { payments: rows.map((p) => ({ ...publicPayment(p), email: p.email, userId: p.user_id, note: p.note })) };
});
route('POST', '/api/admin/payments/:id/:action', async ({ user, params }) => {
  const admin = needAdmin(user);
  if (params.action === 'approve') { await markPaid(params.id, 'approved by ' + admin.email); return { ok: true }; }
  if (params.action === 'reject') { await q(`update payments set status='rejected', note=$2 where id=$1 and status<>'paid'`, [params.id, 'rejected by ' + admin.email]); return { ok: true }; }
  throw err(400, 'bad_request', 'Unknown action.');
});
route('GET', '/api/admin/users', async ({ user, query }) => {
  needAdmin(user);
  const s = '%' + clampStr(query.q, 100).toLowerCase() + '%';
  const rows = await q(`select id, email, name, created_at, plan, plan_exam, plan_until, disabled from users where lower(email) like $1 or lower(name) like $1 order by created_at desc limit 50`, [s]);
  return { users: rows.map((x) => ({ ...x, active: activePlan(x) })) };
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

route('GET', '/api/admin/costs', async ({ user }) => {
  needAdmin(user);
  const month = await one(`select coalesce(sum(cost_usd),0)::float as usd, count(*)::int as calls, sum(case when cached then 1 else 0 end)::int as cached from ai_usage where at >= date_trunc('month', now())`);
  const byTask = await q(`select split_part(task, ':', case when task like '%:%' then 2 else 1 end) as task, coalesce(sum(cost_usd),0)::float as usd, count(*)::int as calls, sum(case when cached then 1 else 0 end)::int as cached
    from ai_usage where at >= date_trunc('month', now()) group by 1 order by 2 desc`);
  const byDay = await q(`select to_char(at, 'YYYY-MM-DD') as day, coalesce(sum(cost_usd),0)::float as usd from ai_usage where at > now() - interval '30 days' group by 1 order by 1`);
  const paidUsers = await one(`select count(*)::int as n from users where plan<>'free' and plan_until > now()`);
  const top = await q(`select u.email, coalesce(sum(a.cost_usd),0)::float as usd from ai_usage a join users u on u.id=a.user_id where a.at >= date_trunc('month', now()) group by u.email order by 2 desc limit 10`);
  const audio = await audioStats();
  const pool = await poolStats();
  return { month, byTask, byDay, paidUsers: paidUsers!.n, top, audio: { items: audio!.items, mb: Number(audio!.bytes) / 1048576, hits: Number(audio!.hits) }, pool, usdToTnd: Number(process.env.USD_TND || 3.1) };
});
route('POST', '/api/admin/pool/fill', async ({ user: u, body }) => {
  const user = needAdmin(u); const exam = needExam(body.exam);
  const k = body.k; const i = Number(body.i || 0); const diff = ['foundation', 'exam', 'advanced'].includes(body.diff) ? body.diff : 'exam';
  if (!['L', 'R', 'W', 'S'].includes(k)) throw err(400, 'bad_request', 'Unknown section.');
  const r = await generateItem(P[exam], exam, k, i, diff, { meta: { userId: user.id, exam }, source: 'admin' });
  return { id: r.id, valid: !!r.id, topic: r.data && (r.data.title || '') };
});
route('POST', '/api/admin/pool/:id/audio', async ({ user: u, params, body }) => {
  const user = needAdmin(u);
  const item = await one('select * from pool_items where id=$1', [params.id]);
  if (!item || item.k !== 'L') throw err(404, 'not_found', 'Listening item not found.');
  const doc = { content: { L: { [item.i]: item.content } } };
  const plans = item.exam === 'ielts' ? [IELTS.listeningAudioPlan(doc, item.i)] : toArr<any>(item.content.docs).map((_, d) => TEF.listeningAudioPlan(doc, item.i, d));
  const all: { c: any; pl: any }[] = []; plans.forEach((pl) => pl && pl.chunks.forEach((c: any) => all.push({ c, pl })));
  const n = Number(body.c || 0);
  if (n >= all.length) return { done: true, total: all.length };
  const out = await cachedSpeech(all[n].c.lines, all[n].pl.voices, all[n].pl.style, { userId: user.id, exam: item.exam });
  return { done: n + 1 >= all.length, total: all.length, cached: out.cached };
});
route('POST', '/api/admin/pool/:id/retire', async ({ user, params, body }) => {
  needAdmin(user);
  await q('update pool_items set retired=$2 where id=$1', [params.id, body.retired !== false]);
  return { ok: true };
});

/* ---------------- entry ---------------- */
export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const query = Object.fromEntries(url.searchParams.entries());
  const headers = new Headers();
  try {
    const method = req.method.toUpperCase();
    // Simple CSRF guard: the app sends this header on every write; other sites can't without CORS.
    if (method !== 'GET' && method !== 'HEAD' && !path.includes('webhook') && req.headers.get('x-requested-with') !== 'prep-canada') {
      throw err(403, 'forbidden', 'Missing request header.');
    }
    let match: (typeof routes)[number] | null = null;
    let params: Record<string, string> = {};
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(path);
      if (m) { match = r; params = m.groups || {}; break; }
    }
    if (!match) throw err(404, 'not_found', 'Not found.');
    const body = method === 'GET' ? {} : await readBody(req);
    const user = await currentUser(req);
    const out = await match.fn({ req, body, query, params, user, headers });
    if (out instanceof Response) return out;
    return json(200, out ?? { ok: true }, headers);
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: { code: e.code, message: e.message, ...(e.extra || {}) } }, headers);
    console.error(e);
    return json(500, { error: { code: 'server_error', message: 'Something went wrong on our side. Try again.' } });
  }
}
