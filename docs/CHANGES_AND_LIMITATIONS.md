# Vittoria — Changes & Open Items

Living document. Tracks every deviation from `Claude_Code_Prompt_Ads_Dashboard.md`, decisions made on the way, and known limitations to revisit. Reference the spec section in brackets so we can compare apples-to-apples.

## 1. Stack & version drifts

| Spec says | We installed | Reason |
|-----------|--------------|--------|
| Next.js 15 | **Next.js 16.2.4** | `create-next-app@latest` defaults to 16. App Router / Server Components / Server Actions APIs are stable across 15→16. Approved during step-1 pause. |
| React 19 (implied) | **React 19.2.4** | Pulled by Next 16. |
| Prisma (no version) | **Prisma 6.19.3** | Tried 7.8 first, but Prisma 7 dropped `url` from `schema.prisma` (requires `prisma.config.ts` + driver adapter wiring). Pinned to 6 to keep schema idiomatic. Revisit when we want Prisma 7's TypedSQL features. |
| Tailwind v4 + shadcn/ui (Radix) | Tailwind v4 + **shadcn/ui Base UI variant** | The latest shadcn registry (`init -d`) ships the Base UI port now, not Radix. Pattern impact: components use a `render={<Link/>}` prop and `nativeButton={false}` instead of Radix's `asChild`. All call sites updated. |
| `tailwind.config.ts` brand tokens | CSS-variable tokens in `globals.css` `@theme` block | Tailwind v4 inlines the theme in CSS — `tailwind.config.ts` is mostly empty. Brand colors live as `--brand`, `--meta`, `--google` CSS vars (light + dark variants). |
| Auth.js v5 | next-auth `^5.0.0-beta.31` | v5 is still in beta but is what the spec asked for. |
| Inter font | ✅ Inter (UI) + Geist Mono (numbers) | |

## 2. Schema additions beyond §4

We added three pieces beyond the literal §4 model list. All are needed by features the spec describes elsewhere (§6, §7, §8) but didn't include in the schema list.

| Model / field | Why we added it | Spec ref |
|---------------|-----------------|----------|
| `Order` (full model) | §6 / §14 require manual backend orders for "Real ROAS". Without it, the "two ROAS" idea can't work. | §6, §14 |
| `LoginAttempt` (full model) | §8 requires "lock account after 5 failed attempts in 15 minutes". Needs persistence; Redis isn't part of the stack. | §8 |
| `Channel` enum on `AdAccount` (`META`/`GOOGLE`) | §7 says "structure the data layer to allow Google Ads later." Cheap to add now, hard to retrofit. | §7 |
| `ChannelStat` (full model) | New: stores manually-entered Google Ads period totals (spend / impressions / clicks / conversions / revenue). Required because we did not implement a real Google Ads API integration. See §3 below. | (extension) |
| Cascading deletes on AdAccount/Order/Report when Client is deleted | Operational safety. | (extension) |
| `lastSyncError`, `tokenExpiresAt` on AdAccount | Surface connection health on settings page. | §7 |

## 3. Google Ads — manual entry only (MVP)

**What ships:** A `ChannelStat` row per period entered via the client's Settings page. Fields: spend, impressions, clicks, conversions, revenue, currency, notes. The dashboard's per-client overview renders a Google Ads panel parallel to Meta. The .docx report includes Section 3 "Google Ads" only when at least one `ChannelStat` row overlaps the report's date range.

**What's missing:** No real Google Ads API call. No OAuth, no developer token, no customer-ID flow, no scheduled sync. To wire that up later we'd need:

- `googleads-api` (or the official `google-ads-api` npm pkg)
- Developer token (Google Ads side, separate approval)
- OAuth refresh-token flow per managed customer
- A `googleAccountId` field on `AdAccount` (currently the `metaAccountId` field is shared)
- A second `lib/google/` mirror of `lib/meta/`
- Cron route extension to dispatch per channel

The data layer is already discriminated on `Channel`, so when we add the real API the existing dashboard panels keep working.

## 4. Report generator — known limitations (§9, §10)

These are flagged at the step-10 pause:

1. **Per-row tracked-order detail is not enumerable.** The reference docx lists every order with a "Pixel: SÌ/NO" column. Meta's Insights API only exposes purchase *counts* (and total revenue) — there's no purchase-level breakdown. So the "Ordini Attribuibili a Meta Ads" table in our generator currently lists only the **backend orders** (the explicitly-untracked ones), all marked NO *. Pixel-tracked counts still appear in the funnel and the global cards. To fix: either pull from the order backend (PrestaShop / Shopify / etc.) or require manual entry of tracked orders too.
2. **No auto-narrative "Lettura ·" callouts.** The reference has insight callouts like "Google sta performando meglio… ROAS 2,26x contro Meta 0,89x." Those require an LLM pass over the numbers (or a rules engine). For MVP, the report builder UI lets the user type their own context note + priority bullets instead. To fix: add an optional `insights[]` field on `ReportInput` and a "Generate insights" button that calls the Anthropic API.
3. **No HTML preview of the docx layout.** §6 asks for a "live preview pane (right side, ~50%) showing a rendered HTML mirror." We ship a *data preview* (channel KPI panels) but not a pixel-mirror of the docx layout. The spec also says the helpers should be shared between docx and HTML in `lib/reports/components.ts` — our docx components live there, but a sibling React mirror is not yet written.
4. **Italian-locale currency only matches the reference when language=`it`.** `formatMoney(value, currency, "it")` produces `€914,93` (matches reference). `language="en"` produces `€914.93`. Both are correct for their locale.
5. **Tracking analysis section (§4 of the report) auto-renders only when there's data.** Skipped entirely if no Google + no untracked Meta purchases.
6. **`reach` is account-level only.** Meta's API marks daily reach as misleading when summed; we request `level=account, time_increment=all_days` for that one call. Across multiple ad accounts we sum those (not strictly correct because of cross-account overlap). Fix: enforce one `metaAccountId` per Client or do a per-call dedup.

## 5. UI changes the user requested mid-build

- **Clients listing** changed from TanStack table → modern card grid (`src/app/(app)/clients/clients-grid.tsx`). The old `clients-table.tsx` is still in the tree but not used; safe to delete.
- **Per-client KPI cards** now show 8 metrics: Spend / Impressions / Reach / Purchases (real) / Revenue (real) / ROAS (real) / CPA (real) / CTR (link).
- **Funnel** extended from 5 to **7 stages**: Impressions → Link Clicks → LPV → Add to Cart → Initiate Checkout → Purchases (pixel) → Purchases (real).
- **"Adjust revenue" popover** on the per-client overview (`src/components/quick-add-order.tsx`) — quick way to record an untracked sale without opening the Orders tab.
- **Reach card** shows Frequency hint (`Frequency 2.55×`).
- **Two ROAS** values surface in the cards: the headline ROAS uses the *real* number; a "Pixel ROAS X.XXx" hint appears underneath when pixel and real diverge.

## 6. Auth + middleware notes

- Login flow uses Auth.js v5 Credentials. Bad creds → generic error toast (no enumeration).
- Brute-force throttle in `src/lib/login-attempts.ts`: 5 failures in 15 min = quiet lockout.
- `middleware.ts` triggers a Next 16 deprecation warning (renamed to `proxy.ts`). Same API. Will rename in step 12 polish.
- Password-reset email sender (Resend) is **not wired** yet — `src/app/(auth)/forgot/page.tsx` is a placeholder.
- Token-at-rest: AES-256-GCM via `APP_ENCRYPTION_KEY`, never logged, in `lib/crypto.ts`.

## 7. Local-dev artifacts to clean up before production

- `.env` (root) — gitignored, but: `SEED_MANAGER_PASSWORD=changeme123` is the seeded default. Change before deploy.
- `scripts/fake-data-seed.ts` — synthetic Meta data + a fake AdAccount with an encrypted dummy token. Useful for dev. Delete (or guard with `NODE_ENV==='development'`) before prod.
- `scripts/debug-insights.ts` — quick payload inspector. Same.
- `scripts/gen-report.ts` — runs the docx builder against the seeded synthetic data. Same.
- `reference/Vittoria_Endpoint_Sample.docx` and `Vittoria_Generated_Sample.docx` — output samples for visual diff against the reference. Move out of repo or to `/docs/samples/`.
- The `vittoria_dev` Postgres DB I created locally (port 5432, role `anwarmajidi`) is dev-only.

## 8. Items deferred to step 11 / 12 / 13

- **Step 11**: Manager `/dashboard` — global KPI roll-up (across all clients), daily Recharts LineChart of spend vs revenue, clients table with per-row "Generate Report" button.
- **Step 12 polish**:
  - Rename `src/middleware.ts` → `src/proxy.ts` (Next 16 convention).
  - Suspense skeletons on Server Components (clients listing, per-client overview).
  - `error.tsx` per route group.
  - Sidebar empty-state polish.
  - Verify mobile 375px (KPI cards stack 2×3, sidebar collapses to a sheet — already wired via shadcn).
- **Step 13 tests**:
  - Vitest unit tests for `summarizeInsights` (KPI math) — important because the formulas are §14 of the spec.
  - Playwright e2e: login → click into client → click "Generate Report" → verify download.
- **Step 14 (README)** — spec says PAUSE before drafting. Will ask first.

## 9. Bulk-import flow (Meta BM + Google MCC)

Added 2026-05-05 after the user said "each ad account is a client; with 14 of them across 2 BMs, paste-per-account is tiring."

**Meta:** `/clients/import` (Meta tab) takes one System User token, calls `GET /me/adaccounts` via `src/lib/meta/business.ts`, displays every accessible ad account with checkboxes + editable client name, and bulk-creates one `Client` + one `AdAccount` per selection. The same token is encrypted (AES-256-GCM) and stored on each `AdAccount.accessTokenEnc`. Already-imported `metaAccountId`s are detected and only have their token refreshed (not re-created). For two BMs, run the flow twice.

**Google:** Same page (Google tab). Real OAuth flow with Google's `adwords` scope:
- `/api/google/oauth/start` and `/api/google/oauth/callback` exchange the code, store the refresh token in a 15-min encrypted cookie
- `src/lib/google/customers.ts` calls `customers:listAccessibleCustomers` then `googleAds:searchStream` per customer for descriptive name / currency / timezone
- Same checkbox + import flow; `Channel.GOOGLE` `AdAccount` rows store the **refresh token** in `accessTokenEnc` (the field name is generic enough — refresh-token-vs-access-token is a per-channel detail).
- Manager and test accounts are listed but unchecked by default.

**Gating:** Google tab shows a "setup required" panel until `GOOGLE_ADS_DEVELOPER_TOKEN` + `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` are present in env. Optional `GOOGLE_ADS_LOGIN_CUSTOMER_ID` for manager accounts. Once env is set + dev server restarted, the OAuth flow lights up. **No npm dep added** — uses raw `fetch` against `googleads.googleapis.com/v18/`.

**Sync side:** Google insights sync isn't wired yet — only the onboarding flow is. Daily sync would require a `lib/google/insights.ts` mirroring `lib/meta/insights.ts`, plus extending `/api/cron/sync`. The existing manual-entry `ChannelStat` flow continues to work for any client until that ships.

## 10. Campaign status filter

`/clients/<slug>/campaigns` now defaults to active campaigns only. `src/lib/meta/campaign-status.ts` fetches `effective_status` per campaign (across every META `AdAccount` on the client) and the page filters out anything not in `{ACTIVE, IN_PROCESS, WITH_ISSUES}`. A "Show paused/archived" toggle flips the URL to `?status=all`. Paused/archived rows show a small badge so they're identifiable when shown.

## 11. Things we did NOT add

Listed so we know what's intentionally out of scope:

- No Sentry / PostHog / Stripe (per §13 constraint).
- No localization beyond `it`/`en` for the report. UI is English-only; no `messages/en.json` yet (spec mentions it as a future affordance).
- No multi-tenant / org model — agency = single instance.
- No CSV import for tracked Meta orders (only backend/untracked orders).
- No OAuth dance for Meta (paste system-user token only — per §7).
- No live Google Ads sync (onboarding + customer enumeration only — daily metrics still come from manual `ChannelStat` entries).

---

*Update this file when anything in §1–§7 changes.*
