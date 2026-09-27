# Prep Canada

An installable web app (PWA) for IELTS General Training and TEF Canada:

- **Placement test** in all four skills, using the real format and timings.
- **Personal 12-unit course** built on the results, with lessons, quizzes, marked tasks and timed checkpoints.
- **Unlimited mock tests** that adapt to the learner's latest scores and weakest question types.

Plans are Free, Solo and Duo, paid in TND through Konnect, Flouci or manual D17/bank transfer.

## How it works

| Part | What it does |
|---|---|
| `public/` | The app: `main.js` (accounts, plans, admin, routing), `ielts.js` and `tef.js` (the two coaches). There is no build step. |
| `api/index.js` → `lib/app.js` | One serverless function for every `/api/*` route. |
| `lib/prompts/` | All AI prompts, built on the server from the saved profile, so users can't send their own prompts. |
| `lib/gemini.js` | Calls Gemini for text (JSON) and speech (TTS). The key stays on the server. |
| `lib/plans.js` | Plans, quotas and fair-use limits. |
| `lib/payments.js` | Konnect, Flouci and manual payments. Plans are prepaid and never renew automatically. |
| `lib/db.js` | Postgres. The tables are created on the first request. |

**Free plan:** one placement test per exam, one mock test a month, and device voices for Listening.
**Solo (one exam) and Duo (both exams):** unlimited mocks (fair use: 6 per day), the course, and studio voices.

## Run locally

```bash
npm install
./scripts/devserver.sh        # mock AI + mock payments on http://localhost:3100
NODE_PATH=$(npm root -g) node test/e2e.cjs   # full browser test (needs Playwright)
```

For real AI locally: `DATABASE_URL=pglite:./.data GEMINI_API_KEY=... ADMIN_EMAILS=you@x.com node server.js`

## Deploy (Vercel)

1. Create a Postgres database, for example Neon through Vercel's Storage tab or Supabase, and copy the connection string.
2. Get a Gemini API key at https://aistudio.google.com/apikey. Enable billing for production use, because the free tier's rate limits are low.
3. Import the repo in Vercel, then add the variables from `.env.example`. At minimum you need `DATABASE_URL`, `GEMINI_API_KEY` and `ADMIN_EMAILS`.
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
- **Legal pages:** the Terms and Privacy pages in `public/js/main.js` are a starting draft. Have a Tunisian lawyer review them.
- **Trademarks:** the app says it is not affiliated with IELTS or CCI Paris Île-de-France, and that all scores are estimates. Keep it that way.
