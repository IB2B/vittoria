@AGENTS.md

# Vittoria — context for Claude

This repo is **Vittoria**, an internal multi-client Meta Ads dashboard for the Italian agency **Alpha Digital**. It pulls live insights from Meta, renders KPI cards / funnel / campaigns table per client, and exports a polished `.docx` report styled like the existing Italian "Report Performance Campagne Advertising" template.

## Where we are

The original spec is `docs/Claude_Code_Prompt_Ads_Dashboard.md` (14 build steps). **All 14 steps are done.** Progress, decisions, and open items live in `docs/PROGRESS.md` and `docs/CHANGES_AND_LIMITATIONS.md` — read those before touching anything substantive.

## Hard rules

- **Always check `docs/CHANGES_AND_LIMITATIONS.md` past the user before deviating from the spec.** Track every new deviation by appending to that file.
- Real local Postgres database is `vittoria_dev` (port 5432, role `anwarmajidi`). Connection string is in `.env` (gitignored).
- Dev port is **3001** because the user has another Next.js project on 3000. Don't try to free 3000.
- The user prefers terse pacing — keep moving without pausing for permission unless something is risky / irreversible. They will say "keep going" or "good job" — that's the signal to continue.
- Cleanup has happened: `scripts/` was deleted (synthetic seeders) and the synthetic ad account / orders / Google `ChannelStat` rows were removed from the DB. **Do not regenerate fake data without asking.**

## Stack snapshot (matches `docs/CHANGES_AND_LIMITATIONS.md` §1)

Next.js 16 · React 19 · Tailwind v4 · shadcn/ui (Base UI variant — uses `render={<Link/>}` + `nativeButton={false}`, NOT Radix `asChild`) · Auth.js v5 · Prisma 6 · Postgres · Recharts · TanStack Table · `docx` · Vitest · Playwright.

## Open user requests, last seen

- Connect to **Supabase** (Postgres) and to the user's real **Meta ad account** (system-user token paste). README has both how-tos under "Going live". User has not done either yet.
- A real Google Ads API integration is not done — manual `ChannelStat` entry only (see `CHANGES_AND_LIMITATIONS.md` §3).

## Don't do these without asking

- Add Sentry / PostHog / Stripe / any third-party SDK (per spec §13).
- Add documentation files unless explicitly asked.
- Run `npx playwright install` again (Chromium already downloaded).
- Touch `reference/` — that's the visual source of truth for the .docx layout.
