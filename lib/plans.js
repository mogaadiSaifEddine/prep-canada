// Plans, prices and what each plan allows. Prices are in TND, VAT included (TTC).
import { one, q } from './db.js';
import { err, today } from './util.js';

const DEFAULT_PRICES = { solo: { month: 15, year: 150 }, duo: { month: 25, year: 250 } };
export function prices() {
  try { return Object.assign({}, DEFAULT_PRICES, JSON.parse(process.env.PRICES_TND || '{}')); }
  catch { return DEFAULT_PRICES; }
}
export const EXAMS = ['ielts', 'tef'];
export const PERIOD_DAYS = { month: 30, year: 365 };

export const LIMITS = {
  free: { aiPerDay: 80, ttsPerDay: 0, mocksPerMonth: 1, placementsPerExam: 1 },
  paid: { aiPerDay: 600, ttsPerDay: 400, testsPerDay: 6, sectionsPerMonth: Number(process.env.PAID_SECTIONS_PER_MONTH || 60) }
};

export function activePlan(u) {
  if (u && u.plan !== 'free' && u.plan_until && new Date(u.plan_until) > new Date()) {
    return { plan: u.plan, exam: u.plan === 'solo' ? u.plan_exam : null, until: new Date(u.plan_until).toISOString() };
  }
  return { plan: 'free', exam: null, until: null };
}
export function isPaidFor(u, exam) {
  const p = activePlan(u);
  return p.plan === 'duo' || (p.plan === 'solo' && p.exam === exam);
}
export function entitlements(u) {
  const out = {};
  for (const ex of EXAMS) {
    const paid = isPaidFor(u, ex);
    out[ex] = { paid, course: paid, lessons: paid, tts: paid, unlimitedMocks: paid };
  }
  return out;
}

export async function bumpUsage(userId, field, limit) {
  const row = await one(
    `insert into usage(user_id, day, ${field}) values($1, $2, 1)
     on conflict(user_id, day) do update set ${field} = usage.${field} + 1
     returning ${field} as n`, [userId, today()]);
  if (row && row.n > limit) throw err(429, 'daily_limit', 'Daily limit reached. It resets at midnight (UTC).');
}

// Called when a test (placement, mock or checkpoint) is started.
export async function sectionsThisMonth(userId, exam) {
  const rows = await q(`select sections from attempts where user_id=$1 and exam=$2 and created_at >= date_trunc('month', now())`, [userId, exam]);
  return rows.reduce((a, r) => a + String(r.sections).split(',').filter(Boolean).length, 0);
}
export async function checkCanStart(u, exam, kind, newSections) {
  const paid = isPaidFor(u, exam);
  if (paid) {
    const r = await one(`select count(*)::int as n from attempts where user_id=$1 and exam=$2 and created_at > now() - interval '1 day'`, [u.id, exam]);
    if (r.n >= LIMITS.paid.testsPerDay) throw err(429, 'daily_limit', 'You have started ' + r.n + ' tests in the last 24 hours. Fair-use limit reached; try again tomorrow.');
    const used = await sectionsThisMonth(u.id, exam);
    if (used + (newSections || 1) > LIMITS.paid.sectionsPerMonth) throw err(429, 'monthly_limit', 'You have used ' + used + ' of your ' + LIMITS.paid.sectionsPerMonth + ' test sections this month' + (used < LIMITS.paid.sectionsPerMonth ? ', not enough for this test. Try a single-skill test' : '') + '. It resets on the 1st.');
    return;
  }
  if (kind === 'placement') {
    const r = await one(`select count(*)::int as n from attempts where user_id=$1 and exam=$2 and kind='placement'`, [u.id, exam]);
    if (r.n >= LIMITS.free.placementsPerExam) throw err(402, 'plan_required', 'The free plan includes one placement test per exam. Upgrade to take it again.');
    return;
  }
  if (kind === 'checkpoint') throw err(402, 'plan_required', 'Course checkpoints are part of the Solo and Duo plans.');
  const r = await one(`select count(*)::int as n from attempts where user_id=$1 and kind='mock' and created_at >= date_trunc('month', now())`, [u.id]);
  if (r.n >= LIMITS.free.mocksPerMonth) throw err(402, 'plan_required', 'The free plan includes one mock test per month. Upgrade for unlimited mock tests.');
}

export function requirePaid(u, exam, what) {
  if (!isPaidFor(u, exam)) throw err(402, 'plan_required', (what || 'This feature') + ' is part of the Solo and Duo plans.');
}

// Extend or start a plan after a confirmed payment.
export async function activate(userId, plan, exam, period) {
  const u = await one('select * from users where id=$1', [userId]);
  if (!u) return;
  const cur = activePlan(u);
  const days = PERIOD_DAYS[period] || 30;
  let start = new Date();
  // Same plan (and same exam for Solo): extend from the current end date.
  if (cur.plan === plan && (plan === 'duo' || cur.exam === exam) && cur.until) start = new Date(cur.until);
  // Upgrading Solo → Duo: credit the unused Solo days at the Solo/Duo price ratio.
  else if (cur.plan === 'solo' && plan === 'duo' && cur.until) {
    const left = (new Date(cur.until) - Date.now()) / 86400000;
    const pr = prices();
    const credit = left * (pr.solo.month / pr.duo.month);
    start = new Date(Date.now() + credit * 86400000);
  }
  const until = new Date(start.getTime() + days * 86400000);
  await q('update users set plan=$2, plan_exam=$3, plan_until=$4 where id=$1', [userId, plan, plan === 'solo' ? exam : null, until.toISOString()]);
}
