# Claude Code Prompt — "Vittoria" Multi-Client Facebook Ads Dashboard

> Paste the entire content below into Claude Code (`/init` a new repo first, then paste this as your first instruction). Claude Code will scaffold the project, install dependencies, and build the app step by step.

---

## 1. Project Goal

Build **Vittoria** — an internal web dashboard used by Alpha Digital (the agency) to manage Facebook (Meta) Ads campaigns for multiple clients in one place. The product name "Vittoria" should appear in the sidebar logo, browser title (`<title>Vittoria — Ads Dashboard</title>`), login screen, and `package.json`. The app must:

1. Authenticate two kinds of users: **agency managers** (full access to all clients) and **clients** (read-only access to their own data).
2. Connect to the **Meta Marketing API** to pull live campaign data per client (ad accounts).
3. Display a clean, modern dashboard with the most important KPIs: **Spend, Purchases, Revenue, ROAS, CPA, CPC, CTR, Reach, Impressions, Frequency, CPM, Link Clicks, Landing Page Views**.
4. Let the manager (or client) **download a polished `.docx` report with one click** — same visual style and structure as the existing Italian "Report Performance Campagne Advertising" template (red-wine `#8B1538` brand, blue `#1877F2` Meta sections, green `#0F9D58` Google sections, white metric cards, header tables, callout boxes, priority rows).

The app should look and feel like a **modern SaaS product** (think Linear / Vercel / Posthog quality).

---

## 2. Locked Tech Stack

Use exactly these. Do not substitute without asking:

| Layer | Choice |
|-------|--------|
| Framework | **Next.js 15** (App Router, Server Components, TypeScript strict) |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (latest, installed via `npx shadcn@latest`) |
| Charts | **Recharts** (consistent with shadcn) |
| Forms | **react-hook-form** + **zod** validation |
| Auth | **Auth.js (NextAuth v5)** — email + password (Credentials provider), bcrypt-hashed passwords, JWT sessions |
| DB / ORM | **PostgreSQL** + **Prisma** (use `prisma-client-js`) |
| API Client | **fetch** wrapped in a typed `metaClient.ts` for Meta Marketing API |
| Background jobs | Lightweight: **`@vercel/cron`** + a `/api/cron/sync` route |
| Report Generation | **`docx`** npm package (server-side), render route returns a `Blob` — see §9 |
| Icons | **lucide-react** |
| Date handling | **date-fns** |
| State (server) | React Server Components + Server Actions |
| State (client) | **TanStack Query** for data revalidation |
| Tables | **TanStack Table** (already used by shadcn `data-table` recipe) |
| Toasts | **sonner** (shadcn variant) |
| Testing | **Vitest** for utils, **Playwright** for the login + dashboard happy path |
| Deployment | Vercel-friendly (no platform lock-in beyond `@vercel/cron`) |

---

## 3. Roles & Permissions

| Capability | Manager | Client |
|------------|---------|--------|
| Sign in with email + password | ✅ | ✅ |
| See list of all clients | ✅ | ❌ (only own) |
| Create / edit / archive a client | ✅ | ❌ |
| Connect a Meta ad account to a client | ✅ | ❌ |
| View dashboard KPIs | ✅ | ✅ (own only) |
| Filter by date range / campaign / ad set | ✅ | ✅ |
| Generate `.docx` report | ✅ | ✅ |
| Edit account-level settings | ✅ | ❌ |
| See audit log | ✅ | ❌ |

Enforce permissions in **both** the UI (hide buttons) and Server Actions (throw `Forbidden`). Never trust the client.

---

## 4. Data Model (Prisma)

```prisma
model User {
  id             String   @id @default(cuid())
  email          String   @unique
  passwordHash   String
  name           String?
  role           Role     @default(CLIENT)
  clientId       String?  // for CLIENT users — which Client they belong to
  client         Client?  @relation(fields: [clientId], references: [id])
  createdAt      DateTime @default(now())
  lastLoginAt    DateTime?
}

enum Role { MANAGER CLIENT }

model Client {
  id            String        @id @default(cuid())
  name          String
  slug          String        @unique          // e.g. "note-del-chianti"
  brandColor    String?       // hex, used in their report header
  logoUrl       String?
  archived      Boolean       @default(false)
  adAccounts    AdAccount[]
  users         User[]
  createdAt     DateTime      @default(now())
}

model AdAccount {
  id                String   @id @default(cuid())
  clientId          String
  client            Client   @relation(fields: [clientId], references: [id])
  metaAccountId     String   // act_xxxxxxxxx
  accessTokenEnc    String   // encrypted at rest (AES-256-GCM via APP_ENCRYPTION_KEY)
  tokenExpiresAt    DateTime?
  currency          String   @default("EUR")
  timezone          String   @default("Europe/Rome")
  lastSyncedAt      DateTime?
  syncSnapshots     SyncSnapshot[]
}

model SyncSnapshot {
  id           String     @id @default(cuid())
  adAccountId  String
  adAccount    AdAccount  @relation(fields: [adAccountId], references: [id])
  takenAt      DateTime   @default(now())
  rangeStart   DateTime
  rangeEnd     DateTime
  payload      Json       // raw insights response, normalized
}

model Report {
  id          String   @id @default(cuid())
  clientId    String
  rangeStart  DateTime
  rangeEnd    DateTime
  generatedBy String   // userId
  fileUrl     String?  // S3/Blob URL if persisted
  createdAt   DateTime @default(now())
}

model AuditLog {
  id          String   @id @default(cuid())
  userId      String
  action      String   // "client.create", "report.generate", "auth.login.failed"
  meta        Json?
  createdAt   DateTime @default(now())
}
```

Token encryption helper (`lib/crypto.ts`): use Node's `crypto` with AES-256-GCM, key from `APP_ENCRYPTION_KEY` env (32 bytes, base64). Never log decrypted tokens.

---

## 5. App Routes & Page Layout

```
app/
  (auth)/
    login/page.tsx          ← email + password form
    forgot/page.tsx         ← request reset
    reset/[token]/page.tsx
  (app)/
    layout.tsx              ← sidebar + topbar, requires session
    dashboard/page.tsx      ← MANAGER landing: client list + global KPIs
    clients/
      page.tsx              ← table of all clients (MANAGER)
      new/page.tsx
      [slug]/
        page.tsx            ← per-client overview (the meaty dashboard)
        campaigns/page.tsx  ← drill-down: campaign-level table
        adsets/page.tsx
        creatives/page.tsx
        orders/page.tsx     ← backend-attributed orders (manual entry MVP)
        report/page.tsx     ← report builder + Generate button
        settings/page.tsx
    settings/
      profile/page.tsx
      team/page.tsx         ← manage manager users (MANAGER)
  api/
    auth/[...nextauth]/route.ts
    meta/oauth/callback/route.ts   ← long-lived token exchange
    cron/sync/route.ts              ← daily refresh
    reports/[id]/download/route.ts  ← returns docx Blob
```

Use route groups `(auth)` and `(app)` so the auth pages don't get the sidebar.

---

## 6. UI / UX Requirements

### Visual language
- **Sidebar layout** (collapsible on mobile) like shadcn's `dashboard-01` block. Logo top-left, nav items, user menu bottom.
- **Color tokens** in `tailwind.config.ts`:
  - `brand`: `#8B1538` (Note del Chianti wine red — used as default; per-client override possible)
  - `meta`: `#1877F2`
  - `google`: `#0F9D58`
  - Use shadcn's CSS variables for the rest (light + dark mode both).
- Default to **light mode**, but support dark mode via `next-themes` and a toggle in the user menu.
- Use **Inter** as the UI font, **Geist Mono** for numbers in tables.
- All KPI numbers are right-aligned in tables. Currencies use the client's currency symbol with `Intl.NumberFormat`.

### Key screens

#### Login
- Centered card, ~380px wide
- Email + password fields, "Sign in" button (primary), "Forgot password?" link
- Subtle agency logo on top
- Show a sonner toast on auth error, never reveal whether the email exists

#### Manager Dashboard (`/dashboard`)
- Top: 4 KPI cards summing **across all clients** for the selected period (default: last 30 days)
  - Total Spend · Total Purchases · Total Revenue · Blended ROAS
- Below: a **Recharts** `LineChart` of daily spend vs revenue
- Then: a **clients table** (TanStack Table) with: name, status, this-month spend, ROAS, CPA, last sync, action buttons (View, Generate Report)

#### Per-Client Overview (`/clients/[slug]`)
- Header: client logo + name + date-range picker (default: last 30 days, presets: 7d, 30d, this month, last month, custom)
- Row of 6 KPI cards: **Spend · Purchases · Revenue · ROAS · CPA · CTR**
  - Each card shows: big number, label, sparkline of last 14 days, % change vs previous period (green/red)
- A **funnel widget** like the one in the report (Impression → Link Clicks → LPV → Purchases pixel → Purchases real)
- A **campaigns table** with sortable columns and a "Status" pill (Active/Paused/Off)
- A **creatives** card showing top 5 by ROAS
- Right-side panel: **"Backend orders"** — manual table where the manager can add real orders not tracked by the pixel (importable via CSV later)
- Big primary button top-right: **"Generate Report"** — opens the Report Builder

#### Report Builder (`/clients/[slug]/report`)
- Form: date range, sections to include (Meta / Google / Tracking analysis / Priorities), language (IT/EN), notes (free text per priority)
- Live preview pane (right side, ~50% width) showing a rendered HTML mirror of what the docx will look like — same colors, same layout
- Single button: **"Download .docx"** → triggers `/api/reports/[id]/download`
- After download, a record is saved in `Report` table with the file URL.

### Component conventions
- Every page lives in a Server Component, fetches via `await prisma…` or a typed `getX()` helper.
- Forms use Server Actions, never raw `fetch`.
- Keep all Tailwind to the className prop — no inline styles, no styled-components.

---

## 7. Meta Marketing API Integration

### Setup
Use **Meta Marketing API v19.0** (or latest stable). Required scopes when generating the long-lived token: `ads_read`, `business_management`, `read_insights`.

For MVP, do **not** implement the full OAuth dance. Instead:
1. The manager pastes a long-lived **System User Access Token** (generated in Business Manager → System Users → Generate Token) when connecting an Ad Account.
2. We encrypt and store it in `AdAccount.accessTokenEnc`.
3. We refresh the data via the `/api/cron/sync` route (every 4 hours) and on-demand from the UI ("Refresh" button).

### Files to create
```
lib/meta/
  client.ts            ← typed wrapper: get(path, params)
  insights.ts          ← getCampaignInsights(adAccountId, dateRange)
  campaigns.ts         ← listCampaigns, getCampaignById
  types.ts             ← MetaInsight, MetaCampaign, MetaActionStat, etc.
  cache.ts             ← in-memory + DB (SyncSnapshot) caching layer
```

Always request the same field set so the report and the dashboard share data:
```ts
const FIELDS = [
  "campaign_name", "campaign_id",
  "spend", "reach", "frequency", "impressions",
  "cpm", "clicks", "cpc", "ctr",
  "inline_link_clicks", "cost_per_inline_link_click", "inline_link_click_ctr",
  "actions", "action_values", "purchase_roas",
  "cost_per_action_type", "date_start", "date_stop",
];
```

Map purchase counts via `actions.action_type === "offsite_conversion.fb_pixel_purchase"` (or `"omni_purchase"` if available).

### Rate limits
- Wrap all calls with a token-bucket limiter (60 calls / minute / app-user pair).
- Retry on `error.code === 17 || 80004` with exponential backoff (2s, 4s, 8s, give up).
- Surface failures in a `/clients/[slug]/settings` "Connection health" panel.

### Multi-channel readiness
Even though MVP is Meta-only, structure the data layer to allow **Google Ads** later. Use a `Channel` enum (`META`, `GOOGLE`) and a discriminated union for insights. The report generator already needs both (see §9).

---

## 8. Authentication Details

- **Auth.js v5** with the Credentials provider, JWT strategy (no DB sessions for simplicity).
- Password hashing: `bcryptjs` with cost 12.
- On first run, seed **one manager user** from `.env`:
  ```
  SEED_MANAGER_EMAIL=admin@alpha.digital
  SEED_MANAGER_PASSWORD=changeme123
  ```
  Run via `npx prisma db seed`.
- **Forgot password**: send a one-time reset token via email. Use **Resend** (free tier) — or, if no email provider is configured, log the reset link to the server console with a clear `[DEV] Reset link:` prefix.
- Brute-force protection: lock account after 5 failed attempts in 15 minutes (track in a `loginAttempts` table or Redis if available).
- Session cookie: `httpOnly`, `secure`, `sameSite: lax`, max age 7 days, sliding.
- Add a **CSRF protection** middleware on all Server Actions (Auth.js v5 handles this with `csrfToken`).

---

## 9. Report Generation (`.docx`)

Mirror the existing template that the agency uses for **Note del Chianti**. Style guide:

| Element | Spec |
|---------|------|
| Page size | A4 (`width: 11906, height: 16838` DXA) |
| Margins | 1080 DXA (~0.75") all sides |
| Default font | Arial 11pt |
| Brand color | `#8B1538` (overridable per client) |
| Section accents | Meta blue `#1877F2`, Google green `#0F9D58`, alerts red `#C00000`, warnings amber `#BF8F00`, success `#107C41` |
| Header rows | White text on accent fill, bold 9pt |
| Body cells | Border `#BFBFBF` size 4, zebra `#F7F7F7` on odd rows |
| Cell margins | 100/100/80/80 DXA |
| Metric cards | 4-card row, big number 40pt in accent color, label bold 10pt, sub muted 9pt |
| Callout box | Heavy left border 18 DXA in accent, soft fill `#E7F0F9` etc. |

Implementation:
- `lib/reports/buildReportDoc.ts` — accepts a typed `ReportInput` and returns a `Buffer` (uses `docx` npm package).
- `ReportInput` includes: `client`, `period`, `meta` (insights + manual orders), `google?`, `priorities[]`, `language: 'it' | 'en'`.
- The function must produce **the exact section order** of the existing Note del Chianti report:
  1. Header + subtitle
  2. Context callout
  3. Global metrics (4 cards) + channel comparison table
  4. Meta section (4 cards + funnel + delivery table + orders table)
  5. Google section (4 cards + orders table) — skipped if no Google data
  6. Tracking analysis table + implications callout
  7. Priorities (4 colored rows)

Reuse the helper functions (`metricCard`, `dataTable`, `calloutBox`, `priorityRow`) — they should be kept in a shared `lib/reports/components.ts` so the live HTML preview can render the same data through equivalent React components.

A reference implementation of this builder already exists in the project repository under `/reference/make_chianti_report.js` (Node script, ~600 lines). **Use it as the source of truth** for layout, copy strings, and color choices. Port it to TypeScript and parametrize all hard-coded numbers from `ReportInput`.

The download endpoint:
```ts
// app/api/reports/[id]/download/route.ts
export async function GET(req: Request, { params }) {
  const report = await getReportForUser(params.id, session.user);
  const input = await assembleReportInput(report.clientId, report.rangeStart, report.rangeEnd);
  const buffer = await buildReportDoc(input);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Report_${slug}_${dateStr}.docx"`,
    },
  });
}
```

---

## 10. Environment Variables

Create `.env.example` with:
```
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
APP_ENCRYPTION_KEY="32-byte-base64-key-for-token-encryption"
META_APP_ID="optional-for-future-oauth"
META_APP_SECRET="optional-for-future-oauth"
RESEND_API_KEY="optional"
SEED_MANAGER_EMAIL="admin@alpha.digital"
SEED_MANAGER_PASSWORD="changeme123"
CRON_SECRET="long-random-string"
```

Document how to generate `APP_ENCRYPTION_KEY` and `NEXTAUTH_SECRET` in the README.

---

## 11. Acceptance Criteria

The build is **done** when all of these are true:

- [ ] `npm run dev` boots the app on `http://localhost:3000` with no errors.
- [ ] `/login` accepts the seeded manager credentials and redirects to `/dashboard`.
- [ ] `/login` rejects bad credentials with a generic toast (no enumeration).
- [ ] A manager can create a new client (name, slug auto-generated from name, optional logo URL).
- [ ] A manager can connect an Ad Account by pasting a long-lived token; on save, the token is encrypted in the DB (verified by reading the row directly).
- [ ] Per-client dashboard shows **real numbers** from the Meta API after a manual "Refresh" click.
- [ ] All 6 KPI cards (Spend · Purchases · Revenue · ROAS · CPA · CTR) render with a 14-day sparkline and a colored % change vs previous period.
- [ ] Date range picker re-fetches data and updates all KPIs, the funnel, and the campaigns table.
- [ ] "Generate Report" produces a valid `.docx` that opens in Word and Google Docs without errors and visually matches the Note del Chianti template (verify by `python -c "import docx; docx.Document('out.docx')"` and a screenshot diff against the reference PDF).
- [ ] A client user can sign in and **only** see their own client's dashboard; navigating to another client returns 404.
- [ ] Dark mode works on all pages.
- [ ] Mobile (375px) layout works: sidebar collapses to a sheet, KPI cards stack 2×3.
- [ ] `npm run build` succeeds with zero TypeScript errors and zero ESLint warnings.
- [ ] Playwright e2e: login → open client → generate report → download succeeds.

---

## 12. Implementation Order (do these in sequence; commit after each)

1. **Init**: `npx create-next-app@latest vittoria --typescript --tailwind --app --src-dir --import-alias "@/*"`. Add Prisma, shadcn/ui, install all deps from §2.
2. **DB schema** + first migration + seed script.
3. **Auth.js** wired up with Credentials + bcrypt. Login page UI. Middleware to protect `(app)/*`.
4. **App shell**: sidebar layout, user menu, theme toggle. shadcn `dashboard-01` as the base.
5. **Clients CRUD** (manager only): list page (data-table), create form, slug page stub.
6. **Meta client** (`lib/meta/`) + the connection form on the client settings page (paste token, encrypt, save).
7. **Insights pipeline**: cron route + on-demand refresh button. Snapshots saved to `SyncSnapshot`.
8. **KPI cards + funnel + campaigns table** on per-client overview page.
9. **Manual orders** table on `/clients/[slug]/orders` with CSV import.
10. **Report builder + docx generator**, port `/reference/make_chianti_report.js`.
11. **Manager dashboard** (cross-client roll-up) and the **clients table** with per-row "Generate Report" button.
12. **Polish**: dark mode, loading states (Suspense + shadcn skeletons), empty states, error boundaries, sonner toasts.
13. **Tests**: Vitest for `lib/meta/insights.ts` math, Playwright for the happy path.
14. **README**: setup steps, env vars, how to generate Meta tokens, deployment notes.

After step 4, run the app and let me see a screenshot. After step 8, again. After step 10, send the generated `.docx` so I can compare to the reference. **Stop and ask before starting step 14** so we can review.

---

## 13. Constraints & Tone

- **Do not** invent libraries that don't exist. If unsure, check npm.
- **Do not** add Sentry, PostHog, Stripe, or any third-party SDK without asking.
- **Do not** generate copy in languages other than what's in the existing report (Italian for the report content, English for the UI by default — but make UI strings live in `messages/en.json` so we can localize later).
- **Do** keep PRs small: one feature per commit.
- **Do** write self-explanatory variable names — no `data`, `temp`, `result`.
- **Do** respect `npm run lint` strict mode.

When something is ambiguous, **ask before guessing**. When proposing a deviation from this spec, say "I propose X because Y — okay?" and wait.

---

## 14. Quick reference — the report KPIs

For every period, the dashboard and the report should compute and display these from the Meta insights response:

| KPI | Formula |
|-----|---------|
| Spend | `sum(spend)` |
| Impressions | `sum(impressions)` |
| Reach | `account-level reach` (unique) |
| Frequency | `impressions / reach` |
| CPM | `spend / impressions * 1000` |
| Link Clicks | `sum(inline_link_clicks)` |
| CPC (link) | `spend / link_clicks` |
| CTR (link) | `link_clicks / impressions` |
| Landing Page Views | `sum(actions[landing_page_view])` |
| Cost / LPV | `spend / lpv` |
| Purchases (pixel) | `sum(actions[offsite_conversion.fb_pixel_purchase])` |
| Purchases (real) | `pixel + manual backend orders` |
| Revenue | `sum(action_values[purchase])` + manual `Order.value` |
| CPA | `spend / purchases_real` |
| ROAS | `revenue / spend` |

Always show **two ROAS numbers** when manual orders exist:
- "Pixel ROAS" (what Meta dashboard shows)
- "Real ROAS" (with backend orders included)
This is exactly the difference highlighted in the Note del Chianti report's "Tracking Analysis" section.

---

## 15. Done. Now build it.

Start with **step 1** of §12. After scaffolding, show me the file tree and the seed script before installing the rest. Then proceed step by step, committing after each completed step.
