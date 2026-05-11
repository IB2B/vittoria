# Vittoria

Internal multi-client Meta Ads dashboard for Alpha Digital. Two roles: **managers** (full access to every client) and **clients** (read-only on their own data). Pulls live insights from the Meta Marketing API, renders KPI cards / funnel / campaigns table per client, and exports a polished `.docx` report styled to match the existing "Report Performance Campagne Advertising" template.

```
Next.js 16  ·  React 19  ·  Tailwind v4  ·  shadcn/ui  ·  TS strict
Auth.js v5  ·  Prisma 6  ·  Postgres
Recharts  ·  TanStack Table  ·  docx
Vitest  ·  Playwright
```

## Quickstart

```bash
# 1. Install
npm install

# 2. Provision Postgres (any of these)
createdb vittoria_dev                       # local Postgres
# or paste a Supabase / Neon / Railway URL into .env

# 3. Configure env (see "Environment" below)
cp .env.example .env
# edit .env — generate the secrets with the commands shown there

# 4. Migrate + seed
npx prisma migrate dev      # creates tables
npm run db:seed             # creates the manager user from SEED_MANAGER_*

# 5. Run
npm run dev                 # http://localhost:3000
```

Sign in with `SEED_MANAGER_EMAIL` / `SEED_MANAGER_PASSWORD`.

## Environment

`.env.example` is the source of truth. The non-obvious ones:

| Var | How to generate / get |
|-----|-----------------------|
| `DATABASE_URL` | Postgres connection string. Local: `postgresql://USER@localhost:5432/vittoria_dev?schema=public`. Supabase: see "Going live" below. |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_SECRET` | Same value as `NEXTAUTH_SECRET` (Auth.js v5 reads either). |
| `APP_ENCRYPTION_KEY` | 32-byte base64. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Never rotate without re-encrypting all `AdAccount.accessTokenEnc` rows** — old ciphertexts become unreadable. |
| `CRON_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Used as `Authorization: Bearer …` on `/api/cron/sync`. |
| `SEED_MANAGER_EMAIL` / `SEED_MANAGER_PASSWORD` | First-run admin. **Change the password before deploy.** |
| `META_APP_ID` / `META_APP_SECRET` | Optional for MVP — only needed if you wire OAuth later. The current flow uses pasted System User tokens. |
| `RESEND_API_KEY` | Optional. If unset, password-reset links log to the server console. |

## Connecting a Meta ad account

Per-client setup in the agency's Meta Business Manager:

1. **Business Manager → Business Settings → System Users** — pick (or create) a system user, click **Add Assets** and assign the ad account you want to monitor.
2. **System User → Generate Token** — pick the app, scopes: `ads_read`, `business_management`, `read_insights`. Choose **60 days** or **Never expires** (system-user tokens can be long-lived).
3. Copy the token.
4. In Vittoria: `/clients/[slug]/settings` → **Connect a Meta ad account** → paste the ad account ID (looks like `act_123456789`) and the token. Vittoria validates the token by hitting Meta's `/me` for the account, and stores it AES-256-GCM-encrypted with `APP_ENCRYPTION_KEY`.
5. Click **Refresh** on the per-client overview to pull the first 30 days of insights. After that, `/api/cron/sync` keeps it fresh every 4 hours.

If Meta rejects the token, the settings page surfaces the error in the "Connection health" panel.

## Adding Google Ads totals

Google Ads API integration is **not** wired yet (no OAuth, no developer token, no scheduled sync — see `docs/CHANGES_AND_LIMITATIONS.md` §3). For MVP, paste totals manually:

`/clients/[slug]/settings#google` → **Add Google Ads period** → date range + spend / impressions / clicks / conversions / revenue. The dashboard's per-client overview renders a "Google Ads" panel parallel to Meta whenever a `ChannelStat` row overlaps the current date range, and the report's Section 3 is included automatically.

## Roles

- **MANAGER** — full agency view. `/dashboard` rolls up across all clients with a daily spend-vs-revenue chart and a per-client table including a per-row "Generate Report" button. Can create/archive clients, connect ad accounts, edit Google totals, generate any client's report.
- **CLIENT** — read-only on the linked client only. Hits `/dashboard` → redirects to their own `/clients/[slug]`. Cannot see the clients list. Server actions enforce this with `assertClientAccess` — never trust the UI.

Brute-force throttle: 5 failed logins in 15 minutes = quiet lockout. Sessions are 7-day JWTs (`httpOnly`, `sameSite: lax`).

## Generating a `.docx` report

`/clients/[slug]/report` → fill the builder form → **Download .docx**.

- Date range, language (`it` / `en`), optional context note, editable priority rows.
- The report is built server-side from the cached `SyncSnapshot` (last refresh) — click **Refresh** on the overview first if you want fresh numbers.
- Output mirrors the existing Italian "Report Performance Campagne Advertising" template — wine-red brand color, blue Meta sections, green Google sections, callout boxes, priority rows. The reference is in `reference/Report_Campagne_Note_Del_Chianti_30_Aprile_2026.docx` and the source helper layout is `reference/make_chianti_report.js` (the original Node script we ported to TS in `src/lib/reports/`).

Known limits documented in `docs/CHANGES_AND_LIMITATIONS.md` §4 (per-row tracked-order detail isn't enumerable from Meta's API; auto-narrative insight callouts aren't generated).

## Cron / scheduled sync

`/api/cron/sync` re-pulls the last 30 days for every connected ad account. Guard it with `Authorization: Bearer $CRON_SECRET`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR_HOST/api/cron/sync
```

On Vercel, add this to `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/sync", "schedule": "0 */4 * * *" }] }
```

## Scripts

```
npm run dev           # next dev (Turbopack)
npm run build         # production build
npm run start         # production server
npm run lint          # eslint
npm run typecheck     # tsc --noEmit
npm run test          # vitest run (unit tests for KPI math, date ranges, crypto)
npm run e2e           # playwright run (login → dashboard → drill-in → docx download)
npm run db:generate   # prisma generate
npm run db:migrate    # prisma migrate dev
npm run db:seed       # run prisma/seed.ts (idempotent)
npm run db:studio     # prisma studio
```

## Going live

### Postgres → Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **Project settings → Database → Connection string → URI** — copy the *connection pooler* URL (port 6543, with `?pgbouncer=true&connection_limit=1` appended for serverless).
3. Add it to your deploy env as `DATABASE_URL`. Also set `DIRECT_URL` to the direct connection string (port 5432) if you'll run migrations from production — Prisma uses `DIRECT_URL` for `migrate deploy` and `DATABASE_URL` for runtime queries.
4. Run `npx prisma migrate deploy` once against the Supabase URL. Then `npm run db:seed`.

If you switch to Supabase later, your local `vittoria_dev` data does NOT migrate automatically. The clients/ad-accounts/orders you create locally have to be re-created or dumped (`pg_dump`) and restored.

### Hosting → Vercel (Hobby tier compatible)

Production URL: **https://vittoria.intelligentb2b.com**

`vercel.json` is committed at the repo root with the build command, cron schedule, and per-route function timeouts. End-to-end deploy:

1. **Push to GitHub.** `git push` to `main`.
2. **Import in Vercel.** "Add New Project" → pick `IB2B/vittoria` → leave the framework auto-detect (Next.js).
3. **Custom domain.** Project Settings → Domains → add `vittoria.intelligentb2b.com`. Vercel will give you a CNAME or A record to point at — set it on `intelligentb2b.com`'s DNS (likely Cloudflare or your registrar). Once it propagates (a few minutes), Vercel issues an SSL cert automatically.
4. **Set environment variables** in Project Settings → Environment Variables (Production + Preview if you want PR previews to work). Mirror everything from `.env.example`:
   - `DATABASE_URL` — Supabase pooled URL (port 6543, with `?pgbouncer=true&connection_limit=10&pool_timeout=20`)
   - `DIRECT_URL` — Supabase session-mode pooler (port 5432, same `pooler.supabase.com` host — **not** the legacy `db.<ref>.supabase.co`)
   - `NEXTAUTH_SECRET`, `AUTH_SECRET` — same value, generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL=https://vittoria.intelligentb2b.com` for Production. Preview deploys auto-detect host via `trustHost: true` in `auth.ts`.
   - `APP_ENCRYPTION_KEY` — 32-byte base64. **Must match the local key** so existing encrypted Meta tokens decrypt successfully.
   - `CRON_SECRET` — 32-byte hex (Vercel cron sends this as Bearer)
   - `OPENROUTER_API_KEY` — required for Vittoria chat + report narrative
   - `OPENROUTER_APP_URL=https://vittoria.intelligentb2b.com` (used for OpenRouter analytics attribution)
   - `OPENROUTER_APP_TITLE=Vittoria`
   - `SEED_MANAGER_EMAIL`, `SEED_MANAGER_PASSWORD` — only used by `prisma/seed.ts`
5. **Cron is once-daily on Hobby.** Vercel Hobby caps crons at one run per 24h; `vercel.json` schedules `/api/cron/sync` for `0 6 * * *` (06:00 UTC). On Pro, change to `0 */4 * * *` for 4-hour refresh.
6. **Migrations** are NOT run during build. Apply them once, locally, against the Supabase URL **before** the first deploy:
   ```bash
   DATABASE_URL=<supabase-pool> DIRECT_URL=<supabase-direct> npx prisma migrate deploy
   DATABASE_URL=<supabase-pool> DIRECT_URL=<supabase-direct> npm run db:seed
   ```
   For schema changes after launch, run `migrate deploy` against prod before merging the PR.
7. **First open:** visit `https://vittoria.intelligentb2b.com/login`, sign in with the seeded admin, then **change the password** at `/settings/profile` immediately.

**Region.** `vercel.json` pins `fra1` (Frankfurt) — close to Supabase's `eu-west-1` and your Italian users.

**Favicon + OG image.** `src/app/icon.svg` + `apple-icon.tsx` are the brand-blue V. `src/app/opengraph-image.tsx` generates a 1200×630 PNG for social previews on Slack / WhatsApp / X.

#### Hobby tier consequences (read before launch)

`vercel.json` sets `maxDuration: 60` on the chat / cron / report routes, but **that setting is ignored on Hobby** — Hobby caps every serverless function at **10 seconds**. Concrete impact:

- **Vittoria chat with tool use** — a typical multi-tool conversation takes 5–15s end-to-end. On Hobby, anything >10s gets cut off mid-stream. Users will see partial answers.
- **Report builds** — Claude narrative call ~5–8s + docx assembly ~2–3s. Will fail intermittently on Hobby with a 10s deadline.
- **`/api/cron/sync`** — syncing many ad accounts in one daily cron run may not finish within 10s if you have >5 clients. Symptoms: only some clients' snapshots get updated.
- **Cron frequency** — Hobby allows once-per-day; the spec wants every 4h. You can work around this with an external scheduler (cron-job.org, EasyCron, GitHub Actions) hitting `/api/cron/sync` with the `Authorization: Bearer <CRON_SECRET>` header.

**Pro tier ($20/mo) lifts all of these:** function timeout goes to 60s (matches `maxDuration: 60` in `vercel.json`), and cron frequency is unlimited (change the schedule back to `0 */4 * * *`). If the app is for real client work, the upgrade pays for itself within a single failed report.

**Smoke checks on first deploy:**

- `https://vittoria.intelligentb2b.com/api/auth/csrf` → 200 (NextAuth has the right host)
- `/dashboard` loads after sign-in (DB connectivity OK)
- `/business-intelligence` chat replies in <10s (OpenRouter key works)
- Click **Refresh** on a client → pulls new data (outbound HTTPS to graph.facebook.com is fine)

### Meta Ads API with your account

The flow is identical in production — system-user token paste. The token is what binds Vittoria to *your* Meta account; no OAuth round-trip needed. Steps in the "Connecting a Meta ad account" section above.

When you want full OAuth (so clients can authorize their own ad accounts without sharing tokens with the agency), we'll need:
- A Meta App in your Developer Portal — you fill in `META_APP_ID` and `META_APP_SECRET` then.
- Implement `/api/meta/oauth/callback/route.ts` — it's stubbed in the route-tree but not wired.
- Long-lived token exchange (`/oauth/access_token?grant_type=fb_exchange_token`).
- App Review for `ads_read` etc. — Meta requires this for production OAuth on apps not in dev mode. Allow ~2 weeks.

That's a step we can do once you have a real Meta App.

## Project structure (highlights)

```
src/
  app/
    (auth)/login            ← login UI + server action
    (app)/                  ← all signed-in routes (proxy.ts gates these)
      dashboard/            ← agency-wide KPI roll-up + line chart + clients table
      clients/              ← card grid (manager-only)
      clients/[slug]/       ← per-client overview, sub-tabs, settings, report
    api/
      auth/[...nextauth]/   ← Auth.js handlers
      cron/sync/            ← scheduled refresh (Bearer-guarded)
      reports/[id]/download ← .docx generator endpoint
  auth.ts                   ← NextAuth config (Credentials + bcrypt + JWT + lockout)
  proxy.ts                  ← route guard (was middleware.ts pre-Next-16)
  lib/
    db.ts                   ← Prisma singleton
    crypto.ts               ← AES-256-GCM token encryption
    permissions.ts          ← role helpers + Forbidden errors
    auth-helpers.ts         ← requireUser, requireManager
    clients.ts              ← getClientForUser, assertClientAccess
    date-range.ts           ← preset → range, previous range, delta
    insights-assembly.ts    ← combined Meta + Google KPI assembly per period
    dashboard-rollup.ts     ← agency-wide aggregation
    format.ts               ← Intl-based currency / percent / ROAS
    meta/                   ← Meta Marketing API client (rate-limited, retrying)
    reports/                ← .docx builder, components, i18n, assemble
prisma/
  schema.prisma             ← User / Client / AdAccount / SyncSnapshot / Order /
                            ←   Report / AuditLog / LoginAttempt / ChannelStat
  seed.ts
docs/
  Claude_Code_Prompt_Ads_Dashboard.md  ← the original spec
  CHANGES_AND_LIMITATIONS.md           ← every deviation and open item
reference/
  Report_Campagne_Note_Del_Chianti_30_Aprile_2026.docx  ← visual source of truth
  make_chianti_report.js                                ← original layout helpers
tests/
  e2e/happy-path.spec.ts    ← Playwright happy path
src/**/*.test.ts            ← Vitest unit tests
```

See `docs/CHANGES_AND_LIMITATIONS.md` for everything we deviated on, every open TODO, and what's intentionally out of scope.
