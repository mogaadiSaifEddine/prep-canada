// Database access. Works with any Postgres (Neon, Supabase, Render…) through DATABASE_URL,
// and with an in-process PGlite database for local testing (DATABASE_URL=pglite:./.data).
let impl = null;
let ready = null;

const SCHEMA = `
create table if not exists users(
  id text primary key,
  email text unique not null,
  pass_hash text not null,
  name text not null default '',
  created_at timestamptz not null default now(),
  consent_at timestamptz,
  plan text not null default 'free',
  plan_exam text,
  plan_until timestamptz,
  disabled boolean not null default false
);
create table if not exists sessions(
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists docs(
  user_id text not null references users(id) on delete cascade,
  exam text not null,
  key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(user_id, exam, key)
);
create table if not exists attempts(
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  exam text not null,
  kind text not null,
  sections text not null,
  diff text not null,
  created_at timestamptz not null default now(),
  gen_calls int not null default 0,
  mark_calls int not null default 0,
  turns int not null default 0
);
create index if not exists attempts_user on attempts(user_id, created_at);
create table if not exists payments(
  id text primary key,
  user_id text not null,
  email text not null,
  method text not null,
  plan text not null,
  exam text,
  period text not null,
  amount_millimes int not null,
  status text not null default 'pending',
  provider_ref text,
  reference text,
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists payments_user on payments(user_id, created_at);
create table if not exists usage(
  user_id text not null references users(id) on delete cascade,
  day date not null,
  ai_calls int not null default 0,
  tts_calls int not null default 0,
  primary key(user_id, day)
);
create table if not exists resets(
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists pool_items(
  id text primary key,
  exam text not null,
  k text not null,
  i int not null,
  diff text not null,
  topic text not null default '',
  types text not null default '',
  content jsonb not null,
  source text not null default 'user',
  uses int not null default 0,
  reports int not null default 0,
  retired boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pool_bucket on pool_items(exam, k, i, diff, retired);
create table if not exists pool_seen(
  user_id text not null references users(id) on delete cascade,
  item_id text not null,
  seen_at timestamptz not null default now(),
  primary key(user_id, item_id)
);
create table if not exists pool_reports(
  user_id text not null,
  item_id text not null,
  reason text,
  created_at timestamptz not null default now(),
  primary key(user_id, item_id)
);
create table if not exists lesson_pool(
  key text primary key,
  exam text not null,
  skill text not null,
  title text not null,
  level text not null,
  content jsonb not null,
  uses int not null default 0,
  reports int not null default 0,
  retired boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists audio_cache(
  key text primary key,
  mime text not null,
  bytes bytea not null,
  size int not null,
  hits int not null default 0,
  created_at timestamptz not null default now(),
  last_hit timestamptz not null default now()
);
create table if not exists ai_usage(
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id text,
  exam text,
  task text not null,
  model text,
  in_tok int not null default 0,
  out_tok int not null default 0,
  audio_sec real not null default 0,
  cost_usd real not null default 0,
  cached boolean not null default false
);
create index if not exists ai_usage_at on ai_usage(at);
alter table users add column if not exists lang text;
create table if not exists settings(
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
`;

async function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw Object.assign(new Error('DATABASE_URL is not set'), { status: 500, code: 'config' });
  if (url.startsWith('pglite')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = url.slice('pglite:'.length) || undefined;
    const p = new PGlite(dir);
    return { q: async (text, args = []) => (await p.query(text, args)).rows, exec: (t) => p.exec(t) };
  }
  const postgres = (await import('postgres')).default;
  const local = /localhost|127\.0\.0\.1/.test(url);
  const sql = postgres(url, { max: 3, idle_timeout: 20, prepare: false, ssl: local ? false : 'require' });
  return { q: (text, args = []) => sql.unsafe(text, args), exec: (t) => sql.unsafe(t) };
}

export async function db() {
  if (!ready) {
    ready = (async () => {
      impl = await connect();
      await impl.exec(SCHEMA);
      return impl;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export async function q(text, args) {
  const d = await db();
  return d.q(text, args);
}
export async function one(text, args) {
  const rows = await q(text, args);
  return rows[0] || null;
}
