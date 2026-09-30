// Pool + audio cache check. Server must run with AI_MOCK=1 PAYMENTS_MOCK=1 POOL_FRESH_SMALL=0 ADMIN_EMAILS=admin@x.tn
const BASE = process.env.BASE || 'http://localhost:3100';
const H = { 'content-type': 'application/json', 'x-requested-with': 'prep-canada' };
let failures = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) failures++; };

async function client(email) {
  let cookie = '';
  const call = async (method, path, body, raw) => {
    const r = await fetch(BASE + path, { method, headers: { ...H, cookie }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    if (raw) return r;
    const j = await r.json().catch(() => null); if (!r.ok) throw Object.assign(new Error(path + ' ' + r.status), { body: j }); return j;
  };
  await call('POST', '/api/auth/signup', { email, password: 'secret123', name: email.split('@')[0], consent: true });
  return call;
}
const start = (c, exam, kind, sections) => c('POST', '/api/attempts/start', { exam, kind, sections, diff: 'exam' }).then((r) => r.id);
const gen = (c, exam, id, k, i) => c('POST', '/api/ai', { exam, task: 'gen', attemptId: id, k, i });
const seen = (c, exam, id, ids) => c('POST', '/api/pool/seen', { exam, attemptId: id, ids });
const save = (c, exam, id, content) => c('PUT', '/api/docs/' + exam + '/attempt_' + id, { data: { id, content, answers: {} } });

(async () => {
  const admin = await client('admin@x.tn');
  const users = [];
  for (const e of ['a@x.tn', 'b@x.tn', 'c@x.tn', 'd@x.tn']) users.push(await client(e));
  const [A, B, C, D] = users;

  // 1. A's placement writes Reading section 1 fresh; B's placement reuses it
  const aId = await start(A, 'ielts', 'placement', ['L', 'R']);
  const aR = await gen(A, 'ielts', aId, 'R', 0);
  ok(!!aR._pool, 'first Reading section is written fresh and added to the pool');
  const bId = await start(B, 'ielts', 'placement', ['L', 'R']);
  const bR = await gen(B, 'ielts', bId, 'R', 0);
  ok(bR._pool === aR._pool, 'second learner gets the same section from the pool');

  // 2. A prefetched part B never opened comes back; once opened, B never gets it again
  const me = await B('GET', '/api/me');
  await admin('POST', '/api/admin/users/' + me.user.id + '/plan', { plan: 'duo', days: 30 });
  const b1 = await start(B, 'ielts', 'mock', ['R']);
  const bR1 = await gen(B, 'ielts', b1, 'R', 0);
  ok(bR1._pool === aR._pool, 'a part that was prefetched but never opened is offered again');
  await seen(B, 'ielts', b1, [bR1._pool]);
  const b2 = await start(B, 'ielts', 'mock', ['R']);
  const bR2 = await gen(B, 'ielts', b2, 'R', 0);
  ok(bR2._pool && bR2._pool !== aR._pool, 'an opened part is never served again; with none left, a new one is written');

  // 3. Audio: A (paid) voices Listening part 1; B plays the same pooled part from the cache
  const meA = await A('GET', '/api/me');
  await admin('POST', '/api/admin/users/' + meA.user.id + '/plan', { plan: 'duo', days: 30 });
  const aL = await gen(A, 'ielts', aId, 'L', 0); await save(A, 'ielts', aId, { L: { 0: aL } });
  const bL = await gen(B, 'ielts', bId, 'L', 0); await save(B, 'ielts', bId, { L: { 0: bL } });
  ok(aL._pool === bL._pool, 'Listening part is shared too');
  const plan = await A('POST', '/api/tts/plan', { exam: 'ielts', attemptId: aId, part: 0 });
  const r1 = await A('GET', '/api/tts/chunk?exam=ielts&attemptId=' + aId + '&part=0&c=2', null, true);
  const r2 = await B('GET', '/api/tts/chunk?exam=ielts&attemptId=' + bId + '&part=0&c=2', null, true);
  ok(r1.status === 200 && r1.headers.get('x-cache') === 'MISS' && r1.headers.get('content-type') === 'audio/mpeg', 'first play generates MP3 audio (' + plan.chunks.length + ' clips in the part)');
  ok(r2.status === 200 && r2.headers.get('x-cache') === 'HIT', 'second learner hears it from the cache');
  const i1 = await A('GET', '/api/tts/chunk?exam=ielts&attemptId=' + aId + '&part=0&c=0', null, true);
  const i2 = await B('GET', '/api/tts/chunk?exam=ielts&attemptId=' + bId + '&part=0&c=0', null, true);
  ok(i2.headers.get('x-cache') === 'HIT', 'narration shared across learners (' + i1.headers.get('x-cache') + ' then HIT)');
  const etag = r1.headers.get('etag');
  const r3 = await (async () => { const rr = await fetch(BASE + '/api/tts/chunk?exam=ielts&attemptId=' + aId + '&part=0&c=2', { headers: { ...H, 'if-none-match': etag, cookie: '' } }); return rr; })();
  ok(r3.status === 401, 'audio needs a signed-in paid user');

  // 4. Reports: 3 different learners retire an item
  const shared = aR._pool;
  for (const [c, id] of [[A, aId], [B, bId]]) { await save(c, 'ielts', id, { R: { 0: aR } }); await c('POST', '/api/pool/report', { exam: 'ielts', attemptId: id, k: 'R', i: 0, reason: 'Wrong answer key' }); }
  const cId = await start(C, 'ielts', 'placement', ['R']);
  const cR = await gen(C, 'ielts', cId, 'R', 0);
  ok(cR._pool === shared || cR._pool === bR2._pool, 'third learner gets a pooled item');
  await save(C, 'ielts', cId, { R: { 0: { ...cR, _pool: shared } } });
  await C('POST', '/api/pool/report', { exam: 'ielts', attemptId: cId, k: 'R', i: 0, reason: 'Question unclear' });
  const dId = await start(D, 'ielts', 'placement', ['R']);
  const dR = await gen(D, 'ielts', dId, 'R', 0);
  ok(dR._pool !== shared, 'an item reported by 3 learners is no longer served');

  // 5. Lessons are pooled by title and level
  const me2 = await C('GET', '/api/me'); await admin('POST', '/api/admin/users/' + me2.user.id + '/plan', { plan: 'duo', days: 30 });
  const course = await A('POST', '/api/ai', { exam: 'ielts', task: 'course' });
  const cv = { title: 'x', version: 'v1', phases: course.phases, progress: {} };
  await A('PUT', '/api/docs/ielts/course', { data: cv }); await C('PUT', '/api/docs/ielts/course', { data: cv });
  await A('POST', '/api/ai', { exam: 'ielts', task: 'lesson', unitId: 'u1' });
  await C('POST', '/api/ai', { exam: 'ielts', task: 'lesson', unitId: 'u1' });
  const costs = await admin('GET', '/api/admin/costs');
  const lesson = costs.byTask.find((x) => x.task === 'lesson');
  ok(lesson && lesson.cached >= 1, 'second learner gets the same lesson from the pool');

  // 6. Monthly limit
  const usage = await A('GET', '/api/usage/ielts');
  ok(usage.sectionsLimit > 0 && usage.sectionsUsed === 2, 'monthly section counter works (' + usage.sectionsUsed + '/' + usage.sectionsLimit + ')');

  // 7. Admin pre-fill and pre-voicing
  const f = await admin('POST', '/api/admin/pool/fill', { exam: 'tef', k: 'L', i: 0, diff: 'exam' });
  let c = 0, res; do { res = await admin('POST', '/api/admin/pool/' + f.id + '/audio', { c: c++ }); } while (!res.done && c < 50);
  ok(f.valid && res.done, 'admin can pre-fill TEF Listening and voice it (' + res.total + ' clips)');
  const costs2 = await admin('GET', '/api/admin/costs');
  const gens = costs2.byTask.filter((x) => x.task === 'gen');
  console.log('  pool buckets:', costs2.pool.buckets.map((b) => b.exam + ' ' + b.k + ' ' + b.diff + ': ' + b.items).join(' | '));
  console.log('  generation calls', gens.reduce((a, x) => a + x.calls, 0), 'of which from pool', gens.reduce((a, x) => a + x.cached, 0), '· audio', costs2.audio.items, 'clips', costs2.audio.mb.toFixed(2), 'MB');
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e.message, e.body || ''); process.exit(1); });
