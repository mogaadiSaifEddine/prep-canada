// Shared content pool. A test part (an IELTS Reading section, a TEF Listening part…) is written by
// the AI once and then reused by other learners at the same level, so most tests load instantly and
// cost nothing to generate.
//
// How an item is chosen for a learner:
//   • never one they have already seen (pool_seen)
//   • same exam, section, part and difficulty
//   • preferred: covers the question types they miss most, on a topic they haven't had, used less often
//   • items reported by several learners are retired automatically
// The pool keeps growing: while a bucket is small, a share of requests still generates fresh
// content (POOL_FRESH_* settings), and anyone who has seen everything gets a new item.
import { q, one } from './db.js';
import { uid, toArr, clampStr } from './util.js';
import { aiJSON } from './gemini.js';
import { logUsage } from './cost.js';
import { textModel } from './gemini.js';

const num = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? Number(process.env[k]) : d);
const FRESH_SMALL = () => num('POOL_FRESH_SMALL', 0.35); // bucket < POOL_SMALL items
const FRESH_MID = () => num('POOL_FRESH_MID', 0.12);     // bucket < POOL_MID items
const FRESH_BIG = () => num('POOL_FRESH_BIG', 0.03);
const SMALL = () => num('POOL_SMALL', 15);
const MID = () => num('POOL_MID', 60);
export const RETIRE_REPORTS = () => num('POOL_RETIRE_REPORTS', 3);

/* ---------- validation: only well-formed content goes into the pool ---------- */
function okQuestions(qs, mcqOnly) {
  return toArr(qs).length > 0 && toArr(qs).every((x) => x && String(x.prompt || '').trim() && toArr(x.answer).length && (!mcqOnly || (toArr(x.choices).length >= 3 && /^[A-D]/i.test(String(toArr(x.answer)[0])))));
}
export function isValid(exam, k, d) {
  if (!d || typeof d !== 'object') return false;
  if (exam === 'ielts') {
    if (k === 'R') return Array.isArray(d.texts) && d.texts.length > 0 && toArr(d.groups).length > 0 && toArr(d.groups).every((g) => okQuestions(g.questions));
    if (k === 'L') return toArr(d.script).length > 2 && toArr(d.groups).length > 0 && toArr(d.groups).every((g) => okQuestions(g.questions));
    if (k === 'W') return !!(d.task1 && d.task1.situation && d.task2 && d.task2.prompt);
    if (k === 'S') return toArr(d.part1).length > 0 && !!(d.part2 && d.part2.card) && toArr(d.part3).length > 0;
  } else {
    if (k === 'R') return toArr(d.docs).length > 0 && toArr(d.docs).every((x) => String(x.body || '').trim() && okQuestions(x.questions, true));
    if (k === 'L') return toArr(d.docs).length > 0 && toArr(d.docs).every((x) => toArr(x.script).length > 0 && okQuestions(x.questions, true));
    if (k === 'W') return !!(d.A && d.A.source && d.B && d.B.statement);
    if (k === 'S') return !!(d.A && d.A.ad && d.B && d.B.ad);
  }
  return false;
}
function topicOf(d) {
  return clampStr(d.title || (d.task2 && d.task2.topic) || (d.part2 && d.part2.topic) || (d.B && d.B.topic) || (d.A && d.A.topic) || '', 80);
}
function typesOf(d) { return [...new Set(toArr(d.groups).map((g) => g && g.type).filter(Boolean))].join(','); }

async function bucketTopics(exam, k, i, diff) {
  const rows = await q(`select topic from pool_items where exam=$1 and k=$2 and i=$3 and diff=$4 and not retired and topic<>'' order by created_at desc limit 40`, [exam, k, i, diff]);
  return rows.map((r) => r.topic);
}

async function store(exam, k, i, diff, data, source) {
  const id = 'pi_' + uid(9);
  await q(`insert into pool_items(id, exam, k, i, diff, topic, types, content, source) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
    [id, exam, k, i, diff, topicOf(data), typesOf(data), JSON.stringify(data), source || 'user']);
  return id;
}
async function markSeen(userId, id) {
  await q(`insert into pool_seen(user_id, item_id) values($1,$2) on conflict do nothing`, [userId, id]);
  await q(`update pool_items set uses=uses+1 where id=$1`, [id]);
}

// Generate one fresh item for a bucket (used by learners and by the admin pre-fill).
export async function generateItem(P, exam, k, i, diff, { att, profile, user, meta, source } = {}) {
  const avoid = await bucketTopics(exam, k, i, diff);
  const g = P.genPrompt(att || { kind: 'mock', diff }, profile || {}, user || {}, k, i, { diff, avoid: [...avoid, ...toArr(profile && profile.usedTopics).slice(-10)] });
  const data = await aiJSON(g.prompt, { fast: g.fast, task: exam + ':gen:' + k, meta });
  let id = null;
  if (isValid(exam, k, data)) id = await store(exam, k, i, diff, data, source);
  return { data, id };
}

// Main entry: content for one part of a learner's test.
export async function contentFor(P, { exam, k, i, att, profile, user }) {
  const diff = P.resolveDiff(att, profile, k);
  const meta = { userId: user.id, exam };
  const size = Number((await one(`select count(*)::int as n from pool_items where exam=$1 and k=$2 and i=$3 and diff=$4 and not retired`, [exam, k, i, diff])).n);
  const cands = await q(`select id, topic, types, uses, content from pool_items p
      where exam=$1 and k=$2 and i=$3 and diff=$4 and not retired
        and not exists(select 1 from pool_seen s where s.user_id=$5 and s.item_id=p.id)
      order by random() limit 30`, [exam, k, i, diff, user.id]);
  const freshP = size < SMALL() ? FRESH_SMALL() : size < MID() ? FRESH_MID() : FRESH_BIG();
  if (cands.length && Math.random() >= freshP) {
    const weak = new Set(P.weakKeys(profile, k));
    const used = new Set(toArr(profile.usedTopics).map((t) => String(t).toLowerCase()));
    let best = null; let bestScore = -Infinity;
    for (const c of cands) {
      let sc = Math.random() * 0.5;                                   // tie-break
      for (const t of String(c.types || '').split(',')) if (weak.has(t)) sc += 2;
      if (c.topic && used.has(c.topic.toLowerCase())) sc -= 5;
      sc -= Math.min(3, Number(c.uses) / 25);                          // spread use across items
      if (sc > bestScore) { bestScore = sc; best = c; }
    }
    await markSeen(user.id, best.id);
    logUsage({ ...meta, task: exam + ':gen:' + k, model: textModel(false), cached: true });
    return { ...best.content, _pool: best.id };
  }
  const { data, id } = await generateItem(P, exam, k, i, diff, { att, profile, user, meta });
  if (id) await markSeen(user.id, id);
  return id ? { ...data, _pool: id } : data;
}

/* ---------- lessons ---------- */
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
export async function lessonFor(P, { exam, unit, profile, user }) {
  const level = P.levelBucket(profile, unit.skill);
  const key = [exam, unit.skill, slug(unit.title), level].join('|');
  const hit = await one(`update lesson_pool set uses=uses+1 where key=$1 and not retired returning content`, [key]);
  if (hit) { logUsage({ userId: user.id, exam, task: exam + ':lesson', model: textModel(false), cached: true }); return hit.content; }
  const data = await aiJSON(P.lessonPrompt(profile, user, unit, level), { task: exam + ':lesson', meta: { userId: user.id, exam } });
  if (data && Array.isArray(data.quiz) && data.quiz.length >= 5) {
    await q(`insert into lesson_pool(key, exam, skill, title, level, content, uses) values($1,$2,$3,$4,$5,$6::jsonb,1) on conflict(key) do nothing`,
      [key, exam, unit.skill, clampStr(unit.title, 160), level, JSON.stringify(data)]);
  }
  return data;
}
export async function lessonCatalog(exam) {
  return q(`select skill, title from lesson_pool where exam=$1 and not retired order by uses desc limit 40`, [exam]);
}

/* ---------- quality: reports from learners ---------- */
export async function report(userId, itemId, reason) {
  const item = await one('select id from pool_items where id=$1', [itemId]);
  if (!item) return { ok: false };
  await q(`insert into pool_reports(user_id, item_id, reason) values($1,$2,$3) on conflict do nothing`, [userId, itemId, clampStr(reason, 200)]);
  const r = await one(`update pool_items set reports=(select count(*) from pool_reports where item_id=$1) where id=$1 returning reports`, [itemId]);
  if (r && r.reports >= RETIRE_REPORTS()) await q('update pool_items set retired=true where id=$1', [itemId]);
  return { ok: true };
}

export async function poolStats() {
  const buckets = await q(`select exam, k, diff, count(*)::int as items, coalesce(sum(uses),0)::int as uses, sum(case when retired then 1 else 0 end)::int as retired
    from pool_items group by exam, k, diff order by exam, k, diff`);
  const reported = await q(`select p.id, p.exam, p.k, p.i, p.diff, p.topic, p.reports, p.retired, (select string_agg(reason, ' · ') from pool_reports r where r.item_id=p.id) as reasons
    from pool_items p where p.reports > 0 order by p.reports desc, p.created_at desc limit 30`);
  const lessons = await one(`select count(*)::int as items, coalesce(sum(uses),0)::int as uses from lesson_pool`);
  return { buckets, reported, lessons };
}
