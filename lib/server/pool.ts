// Shared content pool. A test part (an IELTS Reading section, a TEF Listening part…) is written by
// the AI once and then reused by other learners at the same level, so most tests load instantly and
// cost nothing to generate.
//
// How an item is chosen for a learner:
//   • never one they have already seen (pool_seen)
//   • same exam, section, part and difficulty
//   • preferred: covers the question types they miss most, on a topic they haven't had, used less often
//   • items reported by several learners are retired automatically
// By default a learner gets a new AI-written item only once they have seen every item in the bucket;
// the POOL_FRESH_* settings can make a share of requests generate fresh content anyway.
import { q, one, type Row } from './db';
import type { ExamPrompts, Json } from './prompts/types';
import { uid, toArr, clampStr } from './util';
import { aiJSON } from './gemini';
import { logUsage } from './cost';
import { textModel } from './gemini';

const num = (k: string, d: number) => (process.env[k] !== undefined && process.env[k] !== '' ? Number(process.env[k]) : d);
const FRESH_SMALL = () => num('POOL_FRESH_SMALL', 0); // bucket < POOL_SMALL items
const FRESH_MID = () => num('POOL_FRESH_MID', 0);     // bucket < POOL_MID items
const FRESH_BIG = () => num('POOL_FRESH_BIG', 0);
const SMALL = () => num('POOL_SMALL', 15);
const MID = () => num('POOL_MID', 60);
export const RETIRE_REPORTS = () => num('POOL_RETIRE_REPORTS', 3);

/* ---------- validation: only well-formed content goes into the pool ---------- */
function okQuestions(qs: any, mcqOnly = false) {
  return toArr<any>(qs).length > 0 && toArr<any>(qs).every((x) => x && String(x.prompt || '').trim() && toArr(x.answer).length && (!mcqOnly || (toArr(x.choices).length >= 3 && /^[A-D]/i.test(String(toArr(x.answer)[0])))));
}
export function isValid(exam: string, k: string, d: any) {
  if (!d || typeof d !== 'object') return false;
  if (exam === 'ielts') {
    if (k === 'R') return Array.isArray(d.texts) && d.texts.length > 0 && toArr(d.groups).length > 0 && toArr<any>(d.groups).every((g) => okQuestions(g.questions));
    if (k === 'L') return toArr(d.script).length > 2 && toArr(d.groups).length > 0 && toArr<any>(d.groups).every((g) => okQuestions(g.questions));
    if (k === 'W') return !!(d.task1 && d.task1.situation && d.task2 && d.task2.prompt);
    if (k === 'S') return toArr(d.part1).length > 0 && !!(d.part2 && d.part2.card) && toArr(d.part3).length > 0;
  } else {
    if (k === 'R') return toArr(d.docs).length > 0 && toArr<any>(d.docs).every((x) => String(x.body || '').trim() && okQuestions(x.questions, true));
    if (k === 'L') return toArr(d.docs).length > 0 && toArr<any>(d.docs).every((x) => toArr(x.script).length > 0 && okQuestions(x.questions, true));
    if (k === 'W') return !!(d.A && d.A.source && d.B && d.B.statement);
    if (k === 'S') return !!(d.A && d.A.ad && d.B && d.B.ad);
  }
  return false;
}
function topicOf(d: any) {
  return clampStr(d.title || (d.task2 && d.task2.topic) || (d.part2 && d.part2.topic) || (d.B && d.B.topic) || (d.A && d.A.topic) || '', 80);
}
function typesOf(d: any) { return [...new Set(toArr<any>(d.groups).map((g) => g && g.type).filter(Boolean))].join(','); }

async function bucketTopics(exam: string, k: string, i: number, diff: string): Promise<string[]> {
  const rows = await q(`select topic from pool_items where exam=$1 and k=$2 and i=$3 and diff=$4 and not retired and topic<>'' order by created_at desc limit 40`, [exam, k, i, diff]);
  return rows.map((r) => r.topic);
}

async function store(exam: string, k: string, i: number, diff: string, data: Json, source?: string) {
  const id = 'pi_' + uid(9);
  await q(`insert into pool_items(id, exam, k, i, diff, topic, types, content, source) values($1,$2,$3,$4,$5,$6,$7,$8::text::jsonb,$9)`,
    [id, exam, k, i, diff, topicOf(data), typesOf(data), JSON.stringify(data), source || 'user']);
  return id;
}
async function markSeen(userId: string, id: string) {
  await q(`insert into pool_seen(user_id, item_id) values($1,$2) on conflict do nothing`, [userId, id]);
  await q(`update pool_items set uses=uses+1 where id=$1`, [id]);
}

// Generate one fresh item for a bucket (used by learners and by the admin pre-fill).
type GenOpts = { att?: Json; profile?: Json; user?: Json; meta?: { userId?: string; exam?: string }; source?: string };
export async function generateItem(P: ExamPrompts, exam: string, k: string, i: number, diff: string, { att, profile, user, meta, source }: GenOpts = {}) {
  const avoid = await bucketTopics(exam, k, i, diff);
  const g = P.genPrompt(att || { kind: 'mock', diff }, profile || {}, user || {}, k, i, { diff, avoid: [...avoid, ...toArr(profile && profile.usedTopics).slice(-10)] });
  const data = await aiJSON(g.prompt, { fast: g.fast, task: exam + ':gen:' + k, meta });
  let id: string | null = null;
  if (isValid(exam, k, data)) id = await store(exam, k, i, diff, data, source);
  return { data, id };
}

// Main entry: content for one part of a learner's test.
export async function contentFor(P: ExamPrompts, { exam, k, i, att, profile, user }: { exam: string; k: string; i: number; att: Row; profile: Json; user: Row }) {
  const diff = P.resolveDiff(att, profile, k);
  const meta = { userId: user.id, exam };
  const size = Number((await one(`select count(*)::int as n from pool_items where exam=$1 and k=$2 and i=$3 and diff=$4 and not retired`, [exam, k, i, diff]))!.n);
  const cands = await q(`select id, topic, types, uses, content from pool_items p
      where exam=$1 and k=$2 and i=$3 and diff=$4 and not retired
        and not exists(select 1 from pool_seen s where s.user_id=$5 and s.item_id=p.id)
      order by random() limit 30`, [exam, k, i, diff, user.id]);
  const freshP = size < SMALL() ? FRESH_SMALL() : size < MID() ? FRESH_MID() : FRESH_BIG();
  if (cands.length && Math.random() >= freshP) {
    const weak = new Set(P.weakKeys(profile, k));
    const used = new Set(toArr(profile.usedTopics).map((t) => String(t).toLowerCase()));
    let best: Row | null = null; let bestScore = -Infinity;
    for (const c of cands) {
      let sc = Math.random() * 0.5;                                   // tie-break
      for (const t of String(c.types || '').split(',')) if (weak.has(t)) sc += 2;
      if (c.topic && used.has(c.topic.toLowerCase())) sc -= 5;
      sc -= Math.min(3, Number(c.uses) / 25);                          // spread use across items
      if (sc > bestScore) { bestScore = sc; best = c; }
    }
    await markSeen(user.id, best!.id);
    logUsage({ ...meta, task: exam + ':gen:' + k, model: textModel(false), cached: true });
    return { ...best!.content, _pool: best!.id };
  }
  const { data, id } = await generateItem(P, exam, k, i, diff, { att, profile, user, meta });
  if (id) await markSeen(user.id, id);
  return id ? { ...data, _pool: id } : data;
}

/* ---------- lessons ---------- */
const slug = (s: unknown) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
export async function lessonFor(P: ExamPrompts, { exam, unit, profile, user }: { exam: string; unit: Json; profile: Json; user: Row }) {
  const level = P.levelBucket(profile, unit.skill);
  const key = [exam, unit.skill, slug(unit.title), level].join('|');
  const hit = await one(`update lesson_pool set uses=uses+1 where key=$1 and not retired returning content`, [key]);
  if (hit) { logUsage({ userId: user.id, exam, task: exam + ':lesson', model: textModel(false), cached: true }); return hit.content; }
  const data = await aiJSON(P.lessonPrompt(profile, user, unit, level), { task: exam + ':lesson', meta: { userId: user.id, exam } });
  if (data && Array.isArray(data.quiz) && data.quiz.length >= 5) {
    await q(`insert into lesson_pool(key, exam, skill, title, level, content, uses) values($1,$2,$3,$4,$5,$6::text::jsonb,1) on conflict(key) do nothing`,
      [key, exam, unit.skill, clampStr(unit.title, 160), level, JSON.stringify(data)]);
  }
  return data;
}
export async function lessonCatalog(exam: string) {
  // The most-used titles of each skill (all levels together), so no skill crowds out the others.
  return q(`select skill, title from (
      select skill, title, sum(uses) as uses, row_number() over (partition by skill order by sum(uses) desc) as rn
      from lesson_pool where exam=$1 and not retired group by skill, title
    ) t where rn <= 12 order by skill, uses desc`, [exam]);
}

/* ---------- quality: reports from learners ---------- */
export async function report(userId: string, itemId: string, reason: unknown) {
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
