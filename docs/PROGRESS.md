# Vittoria — Progress log

The purpose of this file: if the user (or a fresh Claude) restarts the machine and walks back in cold, this should be enough to know exactly where we left off. Append-only — newest entries go on top of the "Session log" section. Don't rewrite history, just add.

## Status: ALL 14 STEPS COMPLETE

| Step | Status | Notes |
|------|--------|-------|
| 1. Scaffold Next.js 15 | ✅ Next 16.2.4 + React 19.2.4 (created with `npx create-next-app@latest`) |
| 2. Prisma schema + seed | ✅ Prisma 6.19.3 (downgraded from 7 — see CHANGES §1). Schema has 9 models, 2 migrations applied. |
| 3. Auth.js v5 + login | ✅ Credentials + bcrypt cost 12, JWT 7-day, lockout 5/15min. |
| 4. App shell | ✅ shadcn sidebar, Vittoria logo, theme toggle. |
| 5. Clients CRUD | ✅ List as **card grid** (user requested mid-build, not table), create-form with auto-slug. |
| 6. Meta API client + token connect | ✅ Rate-limited token-bucket, retry/backoff, AES-256-GCM token storage. |
| 7. Insights pipeline + cron | ✅ `/api/cron/sync` Bearer-guarded; on-demand "Refresh" button on overview. |
| 8. Per-client overview UI | ✅ **8 KPI cards** (Spend, Impressions, Reach, Purchases, Revenue, ROAS, CPA, CTR — user expanded from 6), funnel with **7 stages** including ATC + Initiate Checkout. |
| 9. Orders + manual revenue + **Google Ads channel** | ✅ Full Orders module (list/form/CSV import) + inline "Adjust revenue" popover. **`ChannelStat` model added for manual Google Ads totals** — Google API integration deferred (see CHANGES §3). |
| 10. Report builder + .docx | ✅ Ported `reference/make_chianti_report.js` to TS in `src/lib/reports/`. Builder UI with editable priorities, IT/EN, language-aware currency. **Limitations** in CHANGES §4. |
| 11. Manager cross-client dashboard | ✅ `/dashboard` rolls up across all clients, daily Recharts spend-vs-revenue line, table with per-row "Generate Report". |
| 12. Polish | ✅ `loading.tsx` skeletons, `error.tsx` boundaries, `global-error.tsx`, `proxy.ts` rename (Next 16), Recharts width/height -1 warning fixed. |
| 13. Tests | ✅ Vitest 25/25 passing (`insights`, `date-range`, `crypto`); Playwright 3/3 passing (login, bad creds, docx download). |
| 14. README + cleanup | ✅ Full README with quickstart, env vars, Meta token guide, "Going live" (Supabase + Vercel + Meta steps). Cleanup: `scripts/` deleted, sample docx files deleted, synthetic AdAccount/ChannelStat/Orders rows removed from DB. |

## Quality gates as of last session

```
npx tsc --noEmit       → clean
npx vitest run         → 25/25 passing
PORT=3001 npx playwright test → 3/3 passing
npm run lint           → 0 errors, 7 warnings (all `set-state-in-effect` on legitimate hydration patterns)
npm run build          → succeeds
```

## Local dev environment

- **Postgres**: `vittoria_dev` on `localhost:5432`, role `anwarmajidi`. Connection string in `.env` as `DATABASE_URL`.
- **Dev server**: runs on **port 3001** (not 3000 — another `next-server v14.2.18` is on 3000, PID was 97024 last we saw). `NEXTAUTH_URL` in `.env` is set to `http://localhost:3001`.
- **Seeded admin**: `admin@alpha.digital` / `changeme123` (from `SEED_MANAGER_*` env vars).
- **Database state after cleanup** (last verified): 1 Client (`note-del-chianti` — placeholder), 0 AdAccounts, 0 ChannelStats, 0 Orders, 0 SyncSnapshots. The Note del Chianti client exists as a placeholder for the user to connect their real Meta account to.

## What the user wants next (last seen)

1. **Link to Supabase** — replace local Postgres with managed. README has the steps under "Going live → Postgres → Supabase". Will require:
   - `directUrl = env("DIRECT_URL")` line added to `prisma/schema.prisma` `datasource db` block.
   - `DIRECT_URL` (port 5432) and `DATABASE_URL` (pooled, port 6543, with `?pgbouncer=true&connection_limit=1`) set from Supabase Project Settings → Database.
   - `npx prisma migrate deploy && npm run db:seed` against the new URL.
2. **Bulk-onboard the 14 ad accounts** via the new `/clients/import` page. One System User token per BM (×2). The placeholder `note-del-chianti` Client can be deleted once the real one comes in via import (or kept and the real ad account attached via per-client settings).
3. **Procure Google Ads API access** for the 2 client accounts the user has admin on:
   - Apply for a developer token at https://ads.google.com/aw/apicenter (basic access usually approved in 1–2 days)
   - Create an OAuth client in Google Cloud Console with redirect URI `<NEXTAUTH_URL>/api/google/oauth/callback`
   - Set `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (and optional `GOOGLE_ADS_LOGIN_CUSTOMER_ID`) in `.env`
   - Restart server → the Google tab on `/clients/import` lights up and "Sign in with Google" enumerates accessible customers
4. **(Future)** real Google Ads insights sync via `/api/cron/sync` — currently the import flow is wired but daily-sync metrics still rely on manual `ChannelStat` rows. Need a `lib/google/insights.ts` mirror.
5. **(Future)** real OAuth for Meta — only needed if clients should authorize their own ad accounts without sharing tokens with Alpha Digital. Stubs at `/api/meta/oauth/callback/route.ts` (not wired). Requires Meta App Review (~2 weeks).

## Files an incoming Claude needs to know

- `docs/Claude_Code_Prompt_Ads_Dashboard.md` — the original 14-step build spec.
- `docs/CHANGES_AND_LIMITATIONS.md` — every deviation from the spec, every known limitation. **Update this when deviating.**
- `docs/PROGRESS.md` — **this file**. Append session entries below.
- `README.md` — quickstart, env, deployment, "Going live" instructions.
- `reference/Report_Campagne_Note_Del_Chianti_30_Aprile_2026.docx` — visual source of truth for the .docx report.
- `reference/make_chianti_report.js` — original Node script we ported. Don't modify; modify `src/lib/reports/` instead.

## Session log (newest first — append, don't rewrite)

### 2026-05-05 — Leads/Purchases split + Meta-blue + glassmorphism + neutral branding
- **Leads detection**: `src/lib/meta/insights.ts` now extracts `leads` + `costPerLead` from `actions[]` (matches `lead`, `offsite_conversion.fb_pixel_lead`, `onsite_conversion.lead_grouped`, `onsite_conversion.lead_form_submitted`). Added `classifyObjective()` mapping `OUTCOME_LEADS|LEAD_GENERATION → leads`, `OUTCOME_SALES|CONVERSIONS|PRODUCT_CATALOG_SALES → sales`, else `other`. `src/lib/insights-assembly.ts` aggregates leads in `combine()`. `src/lib/meta/insights.test.ts` got 5 new tests; total now 30 passing.
- **Objective-aware UI**: `src/components/campaigns-table.tsx` replaces the static "Purchases" + "ROAS" columns with adaptive "Conversions" + "Performance" cells. Per row, `pickConversionMode()` chooses leads-vs-sales based on the campaign's objective (with a fallback to whichever metric has volume for "other" objectives). Lead-row cells show `leads` count + cost-per-lead; sales-row cells show purchases + ROAS. Inline icon (UserPlus / ShoppingCart) signals which mode is active. Both campaigns page and overview page now fetch `getCampaignStatusMap` and pass `objectiveKind` per row.
- **Overview KPI cards**: replaced the standalone CPA card with a Leads card (CPA folded into Purchases card hint). 8 cards total: Spend, Impressions, Reach, Leads, Purchases (real), Revenue (real), ROAS (real), CTR.
- **Channel KPI panel**: swapped Revenue stat for Leads. Now shows Spend / Leads / Purchases / ROAS. `glass` class applied.
- **Theme — Meta blue + glass**: rewrote `src/app/globals.css`. `--brand` swapped from Alpha-red `#8B1538` → Meta blue `#0866FF` (light + dark variants). Body now renders a fixed multi-radial gradient mesh in brand-blue. Added `.glass`, `.glass-strong`, and `.brand-glow` utility classes (backdrop-blur with saturate, soft inset highlight, brand-tinted drop shadow). Applied `glass` to Sidebar, KPI cards, Channel KPI panel, Clients grid cards, Login card. KPI cards got a corner blur "halo" using a brand-tinted radial gradient. Sidebar V logo got a brand-gradient + soft glow shadow. Active sidebar item gets a brand-tinted background + inset ring + outer glow shadow.
- **Neutralized branding**: removed "Alpha Digital" from `app/layout.tsx` metadata description, sidebar subtitle (now "Multi-channel ads"), login page subtitle, login form description, and the email placeholder ("you@alpha.digital" → "you@example.com"). The docx report was deliberately untouched per user instruction — `creator: "Vittoria — Alpha Digital"` in `src/lib/reports/buildReportDoc.ts` stays. The `reference/` folder also stays.
- **Quality gates**: `tsc --noEmit` clean · `vitest run` 30/30 passing (was 25 + 5 new) · `npm run build` succeeds · `npm run lint` 0 errors / 8 warnings (all `set-state-in-effect`, same convention as before — actually one fewer than last session because the import pickers removed a redundant effect).

### 2026-05-05 — Linked Supabase
- Added `directUrl = env("DIRECT_URL")` to `prisma/schema.prisma` `datasource db` block. Regenerated Prisma client.
- `.env` now has `DATABASE_URL` (transaction pooler, port 6543, with `?pgbouncer=true&connection_limit=1`) and `DIRECT_URL` (session pooler, port 5432). Both use the tenant-scoped username `postgres.<project_ref>` against `aws-0-eu-west-1.pooler.supabase.com`. The legacy `db.<ref>.supabase.co:5432` direct host is **unreachable** on IPv4 networks (Supabase deprecated it) — use the session pooler instead. Local Postgres URL kept commented for rollback.
- Initial password reset (user-provided one didn't authenticate); generated a fresh one in Supabase dashboard. URLs use the new password.
- `npx prisma migrate deploy` → both migrations (`init`, `channel_stats`) applied. `npm run db:seed` → admin user `admin@alpha.digital` ready. `\dt` confirmed all 9 application tables + `_prisma_migrations` exist.
- **Local data did not migrate** — the placeholder `note-del-chianti` Client only existed locally. Supabase DB starts empty; clients will land via the new `/clients/import` flow.

### 2026-05-05 — Bulk-import flow (Meta BM + Google MCC) + campaign status filter
- User flagged: "each ad account is a client; 2 BMs × 7 ad accounts = 14 clients, paste-per-account is tiring." Built bulk-import to fix that.
- New page **`/clients/import`** with Meta + Google tabs, linked from `/clients` page header ("Import from BM" button).
- **Meta tab**: paste one System User token → `src/lib/meta/business.ts:listAccessibleAdAccounts` calls `GET /me/adaccounts` and lists everything the token can see, with editable client names + status badges. Bulk creates `Client` + `AdAccount` rows; already-imported accounts re-use their existing Client and just refresh the token.
- **Google tab**: real OAuth flow (no npm dep — raw `fetch` against `googleads.googleapis.com/v18/`). Routes `/api/google/oauth/start` and `/api/google/oauth/callback` exchange the code, store the refresh token in a 15-min encrypted cookie via `src/lib/google/session.ts`. `src/lib/google/customers.ts` enumerates customers + descriptive names + currency. Bulk import creates `Channel.GOOGLE` AdAccount rows that store the **refresh token** in `accessTokenEnc`. Gated behind `GOOGLE_ADS_DEVELOPER_TOKEN` + `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` env vars; setup-required panel with step-by-step links shows until those are set.
- **Campaign status filter**: `/clients/<slug>/campaigns` now defaults to active-only. New `src/lib/meta/campaign-status.ts` fetches `effective_status` per campaign across all META AdAccounts on a Client; page filter `{ACTIVE, IN_PROCESS, WITH_ISSUES}` ⇄ `all` via URL `?status=all`. Toggle button + hidden-count summary on the card header. Paused/archived rows display a small badge inline.
- Quality gates: `npx tsc --noEmit` clean · `npx vitest run` 25/25 · `npm run lint` 0 errors / 9 warnings (was 7; +2 are legitimate state-sync effects in the new import pickers, same convention as before) · `npm run build` succeeds (3 new routes registered: `/api/google/oauth/start`, `/api/google/oauth/callback`, `/clients/import`).
- **Not yet done in this session**: actual Google Ads insights sync. Onboarding + customer enumeration is wired, but `/api/cron/sync` doesn't yet pull metrics from Google. Manual `ChannelStat` entry continues to work for clients until a `lib/google/insights.ts` mirror gets built. CHANGES_AND_LIMITATIONS.md §9 has details.

### 2026-05-05 — Steps 11→14 + cleanup + Going-Live docs
- Built manager `/dashboard` with global KPI roll-up, daily spend-vs-revenue Recharts LineChart, clients table with per-row "Generate Report" button.
- Polish: added `loading.tsx` skeletons (app + per-client), `error.tsx` boundaries, `global-error.tsx`, renamed `middleware.ts → proxy.ts` (Next 16 convention), fixed Recharts sparkline width/height -1 warning by using fixed 96×32 charts.
- Tests: Vitest unit suites for `summarizeInsights` (KPI math per spec §14), `date-range`, and `crypto` (round-trip + IV randomness + key-mismatch). Playwright e2e for login + bad-creds + docx download. All 28 passing.
- ESLint config: downgraded `react-hooks/set-state-in-effect` to warning and disabled `react/display-name` for inline TanStack column cells. Added `reference/`, `scripts/`, and unused `clients-table.tsx` to globalIgnores.
- README rewritten end-to-end with Supabase + Vercel + Meta token guides. CHANGES_AND_LIMITATIONS.md created earlier in the session.
- Cleanup: deleted `scripts/fake-data-seed.ts`, `scripts/debug-insights.ts`, `scripts/gen-report.ts`, `reference/Vittoria_Generated_Sample.docx`, `reference/Vittoria_Endpoint_Sample.docx`. DB: deleted synthetic AdAccount `act_999000111`, synthetic Google `ChannelStat`, 3 synthetic backend Orders. Note del Chianti `Client` row preserved as placeholder.
- User asked when they can link to Supabase + Meta with their account. Both are documented in README "Going live" — no further code needed for Meta (system-user token paste); Supabase needs the `directUrl` line added to schema.prisma + URLs in env.

### 2026-05-04 — Steps 1→10
- Scaffolded Next.js 16, Prisma 6, Auth.js v5, shadcn/ui Base-UI variant, all §2 deps.
- Schema migrated, manager seeded, login flow verified end-to-end, Brand colors + Inter font wired.
- Per-client overview shipped with 8 KPI cards, 7-stage funnel (ATC + Checkout added per user request mid-step), Meta + Google Ads dual panels (Google manual-entry only).
- Clients page switched from TanStack table to modern card grid (user request).
- Orders module shipped (list + form + CSV import) plus inline "Adjust revenue" popover on the overview.
- `.docx` generator ported from `reference/make_chianti_report.js`. Verified end-to-end via curl: download endpoint returns 200 with correct MIME, valid ZIP structure, all 5 sections present, ATC + Checkout rows in funnel.
- 5 review pauses honored (after step 4 and step 8 via Playwright/curl smoke tests; step 10 sample saved to `reference/` for visual diff). User said "looks good keep going" each time.
