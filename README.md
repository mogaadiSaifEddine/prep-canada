# Prep Canada

An installable web app (PWA) for IELTS General Training and TEF Canada:

- **Placement test** in all four skills, using the real format and timings.
- **Personal 12-unit course** built on the results, with lessons, quizzes, marked tasks and timed checkpoints.
- **Unlimited mock tests** that adapt to the learner's latest scores and weakest question types.

Plans are Free, Solo and Duo, paid in TND through Konnect, Flouci or manual D17/bank transfer.

## How it works

Next.js 16 (App Router) + React 19 + TypeScript. Real URLs (`/ielts`, `/paths/score`…); old `#/…` links are redirected in the browser.

| Part | What it does |
|---|---|
| `app/` | Pages: home, sign-in, plans, billing return, account and receipts, admin, legal, paths (list, map, calculator, draws), and the two coaches (`/ielts`, `/tef`). |
| `app/api/[...path]/route.ts` → `lib/server/app.ts` | One Node route handler for every `/api/*` route (same routes as before). |
| `components/` | React views. `components/coach/` renders the coaches; `components/paths/` the map, stop drawer and estimates. |
| `lib/coach/` | Coach logic (tests, timers, marking, course), as observable controllers the views subscribe to. |
| `lib/client/` | Browser helpers: API client, paths store, audio and dictation, theme. |
| `lib/server/prompts/` | All AI prompts, built on the server from the saved profile, so users can't send their own prompts. |
| `lib/server/gemini.ts` | Calls Gemini for text (JSON) and speech (TTS). The key stays on the server. |
| `lib/server/plans.ts` | Plans, quotas and fair-use limits. |
| `lib/server/payments.ts` | Konnect, Flouci and manual payments. Plans are prepaid and never renew automatically. |
| `lib/server/db.ts` | Postgres. The tables are created on the first request. |
| `lib/shared/` | Code used on both sides: CRS/FSW math, score helpers, shared types. |
| `lib/i18n/`, `lib/paths/` | Interface strings (EN/FR/AR) and the path data per language. |

## Immigration paths

`lib/paths/en.ts` (with `fr.ts` and `ar.ts`) holds 11 routes to permanent residence as maps of stops:
- Express Entry (French draws, FSW, CEC)
- PNP
- Québec (PSTQ / PEQ)
- Francophone Mobility
- FCIP / RCIP
- AIP
- the francophone student pilot
- study → work → PR
- spousal sponsorship

It also lists the paused programs. Each stop has the steps, documents, time, cost, tips for applicants from Tunisia, and a link to the official page. The data was checked on 27 September 2026 (`CHECKED`). **Review it every few months:** draws, fees and pilots change often.

`app/paths/` renders:
- the list
- a "Find my path" helper that uses the learner's IELTS/TEF levels
- one map per path

Progress is saved per account (docs namespace `journey`).

## Score calculator, estimates and latest draws

- **Score calculator** (`#/paths/score`): full CRS grid (out of 1,200, job-offer points removed since March 2025) and the FSW 67-point grid, with partner factors, skill transferability, the French bonus and "what would raise your score". Language levels are pre-filled from the user's IELTS / TEF results. Saved to the account (or on the device for visitors, then moved to the account at sign-up). Math is in `lib/shared/crs.ts`, checked by `npm run test:crs`.
- **Per-path estimate**: on every path, eligibility, the user's CRS against that path's recent cut-offs, timeline, official fees for the household and proof of funds. Path cards show the latest cut-off and a match pill.
- **Latest draws** (`#/paths/draws`): Express Entry per category with a trend chart and the user's score line, Québec Arrima rounds, provincial rounds.
  - Express Entry refreshes **by itself** from IRCC's public JSON feed every 6 hours (`lib/server/draws.ts`, cached in the `settings` table, with the pool distribution). If IRCC can't be reached, the last copy or the bundled data is used.
  - Québec and provinces have no feed: edit them in **Admin → Invitation rounds** (JSON), no redeploy needed. Set `DRAWS_OFFLINE=1` to disable the IRCC fetch.

## Caching and cost control

- **Shared test pool:** each test part is written once, then reused by other learners at the same difficulty.
  - Nobody gets a part they have already seen.
  - The pool prefers parts that cover a learner's weakest question types and topics they haven't had.
  - A new part is written by the AI only when the learner has seen every part in the bucket; it then joins the pool. To keep writing a share of fresh parts anyway, set `POOL_FRESH_SMALL`, `POOL_FRESH_MID`, `POOL_FRESH_BIG` (rates, default 0) with `POOL_SMALL` and `POOL_MID` (bucket sizes).
  - Parts reported by 3 learners are retired automatically (`POOL_RETIRE_REPORTS`).
  - Admin › Test pool can fill and voice the pool before launch (up to 100 sets per run, one level or all three).
- **Lesson pool:** lessons are shared by unit title and level. The course generator is steered towards unit titles that already exist.
- **Audio cache:** every spoken clip is stored once as MP3, keyed by a hash of exactly what is said, and shared across learners. The cache size is capped by `AUDIO_CACHE_MAX_MB` (default 400); the least-played clips are pruned first.
- **Limits:** paid plans get `PAID_SECTIONS_PER_MONTH` test sections per exam (default 60; a full test uses 4) and at most 6 new tests a day.
- **Cost tracking:** every AI call and cache hit is logged with an estimated cost. Admin shows monthly spend, cost per paying user and cache hit rates. Update `AI_PRICES_JSON` when Google changes prices (Gemini 3.8 doubles on 1 Jan 2027). `USD_TND` sets the exchange rate used on the admin page.

## Run locally

```bash
npm install
npm run dev                   # development server on http://localhost:3000 (reads .env)
npm run typecheck
npm run test:crs              # CRS / FSW / draws unit checks
npm run i18n:check            # every interface string translated in fr.ts and ar.ts
```

Browser and API tests run against the production build with mock AI and mock payments:

```bash
npm run build
./scripts/devserver.sh        # http://localhost:3100, fresh database
NODE_PATH=$(npm root -g) node test/e2e.cjs   # also paths.cjs, visitor.cjs, score.cjs, i18n.cjs, look.cjs (needs Playwright)
POOL_FRESH_SMALL=0 ./scripts/devserver.sh && node test/pool.mjs   # pool + audio cache test
```

For real AI locally, put `DATABASE_URL=pglite:./.data`, `GEMINI_API_KEY` and `ADMIN_EMAILS` in `.env`, then `npm run dev`.

## Deploy (Vercel)

1. Create a Postgres database, for example Neon through Vercel's Storage tab or Supabase, and copy the connection string.
2. Get a Gemini API key at https://aistudio.google.com/apikey. Enable billing for production use, because the free tier's rate limits are low.
3. Import the repo in Vercel, then add the variables from `.env.example`. `vercel.json` sets the framework to Next.js, so it builds correctly even if the project was first created with the Node preset. At minimum you need `DATABASE_URL`, `GEMINI_API_KEY` and `ADMIN_EMAILS`.
4. Deploy, then open `/api/health`. It should return `{"ok":true}`.
5. Sign up with an email listed in `ADMIN_EMAILS` to get the Admin page.

### Payments

- **Konnect:** set `KONNECT_API_KEY` and `KONNECT_WALLET_ID`. The webhook `/api/billing/konnect-webhook` is sent automatically with each payment.
- **Flouci:** set `FLOUCI_PUBLIC_KEY` and `FLOUCI_PRIVATE_KEY`. The webhook `/api/billing/flouci-webhook` is sent automatically.
- **Manual:** always on. Set `MANUAL_PAY_INFO` to your D17 number or RIB, then approve payments in Admin.

Every payment is re-verified with the provider before a plan is activated. The amount is checked too.

## Before a public launch (Tunisia)

- **Company and invoicing:** receipts show `BUSINESS_NAME` and `MATRICULE_FISCAL`. Check invoice requirements with your expert-comptable.
- **Law 2004-63:** file the INPDP declaration, and ask for authorisation for transfers abroad (Gemini, and hosting outside Tunisia). Put the number in `INPDP_DECLARATION`.
- **Paying Google and Vercel from Tunisia:** you need a foreign-currency route, such as the Startup Act technology card or a foreign-currency account.
- **Legal pages:** the Terms and Privacy pages in `app/legal/[kind]/page.tsx` are a starting draft. Have a Tunisian lawyer review them.
- **Trademarks:** the app says it is not affiliated with IELTS or CCI Paris Île-de-France, and that all scores are estimates. Keep it that way.
