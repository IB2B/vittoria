import type { MonitoringSeverity } from "@prisma/client";

import type { KpiSummary } from "@/lib/meta";

// Snapshot of one day's KPI per client/campaign — what the detection rules
// receive. Built from the cached SyncSnapshot via `assembleClientInsights`
// inside the monitoring runner.
export type DaySnapshot = {
  date: string; // YYYY-MM-DD
  current: KpiSummary;
};

// 7-day baseline KPIs (medians/averages computed in runner.ts).
export type Baseline = {
  medianCpl: number | null;
  medianCpa: number | null;
  medianCtr: number | null;
  medianDailySpend: number;
  daysWithLeads: number;
  daysWithPurchases: number;
};

export type DetectedAlert = {
  category: string;
  campaignId?: string;
  campaignName?: string;
  title: string;
  description: string;
  suggestion: string;
  severity: MonitoringSeverity;
  metrics: Record<string, unknown>;
  // Dedup key — same (client, category, campaign?, day-bucket) gets the SAME
  // row updated tomorrow instead of spawning a duplicate. Resolved alerts
  // that re-fire still use a fresh suffix so the user sees "this came back".
  dedupKey: string;
};

export type RuleContext = {
  clientId: string;
  clientName: string;
  campaignProfile: "lead_gen" | "ecommerce" | "mixed" | "awareness";
  yesterday: DaySnapshot;
  twoDaysAgo: DaySnapshot | null;
  baseline: Baseline;
  currency: string;
};

const fmt = (n: number | null | undefined, locale = "it-IT", digits = 2) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(n);

const money = (n: number | null, cur: string) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : `${cur} ${fmt(n, "it-IT", 2)}`;

// ─── Individual rule detectors ────────────────────────────────────────────

// Dry day for lead-gen / ecommerce — meaningful spend, zero conversions.
function ruleDryDay(ctx: RuleContext): DetectedAlert | null {
  const k = ctx.yesterday.current;
  if (k.spend < 5) return null; // skip tiny / paused-residual spend
  const profile = ctx.campaignProfile;
  if (profile === "lead_gen") {
    if (k.leads > 0) return null;
    const twoDayDry =
      ctx.twoDaysAgo != null && ctx.twoDaysAgo.current.leads === 0;
    const severity: MonitoringSeverity = twoDayDry ? "CRITICAL" : "HIGH";
    return {
      category: "dry_day_leads",
      title: twoDayDry
        ? "No leads for 2 days in a row"
        : "Zero leads yesterday despite spend",
      description: `Spent ${money(k.spend, ctx.currency)} yesterday with 0 leads detected. ${
        twoDayDry
          ? "Same pattern the day before — this is now a 48-hour gap."
          : ""
      }`,
      suggestion:
        "Likely causes: pixel/CAPI event stopped firing, budget burned by broad audiences, lead form broken. Action: open Events Manager, verify the lead event arrived; if zero, fix tracking before paying for more impressions. If events are firing, pause weakest ad set and reload top performer.",
      severity,
      metrics: {
        spend: k.spend,
        impressions: k.impressions,
        leads: k.leads,
        ctr: k.ctrLink,
      },
      dedupKey: `${ctx.clientId}:dry_day_leads:${ctx.yesterday.date}`,
    };
  }
  if (profile === "ecommerce") {
    if (k.purchasesPixel > 0) return null;
    const twoDayDry =
      ctx.twoDaysAgo != null && ctx.twoDaysAgo.current.purchasesPixel === 0;
    const severity: MonitoringSeverity = twoDayDry ? "CRITICAL" : "HIGH";
    return {
      category: "dry_day_purchases",
      title: twoDayDry
        ? "No purchases for 2 days in a row"
        : "Zero purchases yesterday despite spend",
      description: `Spent ${money(k.spend, ctx.currency)} yesterday with 0 pixel purchases. ${
        twoDayDry ? "Same yesterday-1 — 48 hours dry." : ""
      }`,
      suggestion:
        "Likely causes: pixel Purchase event stopped firing, checkout broken, audience saturation, creative fatigue. Action: place a test order to confirm Purchase fires; check Events Manager 'last received' timestamp; if events OK, refresh top-of-funnel creatives.",
      severity,
      metrics: {
        spend: k.spend,
        impressions: k.impressions,
        purchases: k.purchasesPixel,
        addToCart: k.addToCart,
      },
      dedupKey: `${ctx.clientId}:dry_day_purchases:${ctx.yesterday.date}`,
    };
  }
  return null;
}

// Cost-per-lead spike vs 7-day median.
function ruleCplSpike(ctx: RuleContext): DetectedAlert | null {
  if (ctx.campaignProfile !== "lead_gen" && ctx.campaignProfile !== "mixed") {
    return null;
  }
  const k = ctx.yesterday.current;
  if (k.leads === 0) return null; // dry_day_leads covers this
  if (ctx.baseline.medianCpl == null) return null;
  const cpl = k.costPerLead;
  if (cpl == null) return null;
  const ratio = cpl / ctx.baseline.medianCpl;
  if (ratio < 1.5) return null;
  const severity: MonitoringSeverity = ratio >= 2.5 ? "CRITICAL" : "HIGH";
  return {
    category: "cpl_spike",
    title: `CPL jumped ${Math.round((ratio - 1) * 100)}% vs 7-day median`,
    description: `Yesterday's CPL was ${money(cpl, ctx.currency)} vs a 7-day median of ${money(ctx.baseline.medianCpl, ctx.currency)} (${ratio.toFixed(2)}× baseline).`,
    suggestion:
      "Likely causes: audience saturation (frequency climbing), creative fatigue, competing campaigns from the same advertiser. Action: refresh the top-of-funnel creative, check frequency in Ads Manager (>2.5× across a single audience = fatigue), and rotate in a tested new audience.",
    severity,
    metrics: { cpl, baseline: ctx.baseline.medianCpl, ratio },
    dedupKey: `${ctx.clientId}:cpl_spike:${ctx.yesterday.date}`,
  };
}

// Cost-per-acquisition spike (ecommerce equivalent of CPL spike).
function ruleCpaSpike(ctx: RuleContext): DetectedAlert | null {
  if (ctx.campaignProfile !== "ecommerce" && ctx.campaignProfile !== "mixed") {
    return null;
  }
  const k = ctx.yesterday.current;
  if (k.purchasesPixel === 0) return null;
  if (ctx.baseline.medianCpa == null) return null;
  const cpa = k.cpaPixel;
  if (cpa == null) return null;
  const ratio = cpa / ctx.baseline.medianCpa;
  if (ratio < 1.5) return null;
  const severity: MonitoringSeverity = ratio >= 2.5 ? "CRITICAL" : "HIGH";
  return {
    category: "cpa_spike",
    title: `CPA jumped ${Math.round((ratio - 1) * 100)}% vs 7-day median`,
    description: `Yesterday's CPA was ${money(cpa, ctx.currency)} vs a 7-day median of ${money(ctx.baseline.medianCpa, ctx.currency)} (${ratio.toFixed(2)}× baseline).`,
    suggestion:
      "Likely causes: AOV dropped (cheaper SKU pushing volume), creative fatigue, low-intent audience. Action: check AOV trend and product mix on the landing page; if AOV is fine, the funnel-to-purchase is leaking — refresh creatives or pause the worst-CPA ad set.",
    severity,
    metrics: { cpa, baseline: ctx.baseline.medianCpa, ratio },
    dedupKey: `${ctx.clientId}:cpa_spike:${ctx.yesterday.date}`,
  };
}

// CTR drop — link CTR below 0.5% on meaningful impressions.
function ruleBadCtr(ctx: RuleContext): DetectedAlert | null {
  const k = ctx.yesterday.current;
  if (k.impressions < 1000) return null;
  const ctr = k.ctrLink;
  if (ctr == null) return null;
  if (ctr >= 0.005) return null; // > 0.5% is fine
  const severity: MonitoringSeverity = ctr < 0.003 ? "HIGH" : "MEDIUM";
  return {
    category: "bad_ctr",
    title: `Link CTR collapsed to ${(ctr * 100).toFixed(2)}%`,
    description: `Yesterday's link CTR was ${(ctr * 100).toFixed(2)}% on ${k.impressions.toLocaleString()} impressions — well below the 0.5% floor for healthy delivery.`,
    suggestion:
      "Likely creative is fatigued (audience has seen it too many times) or the hook is weak. Action: launch 2-3 new creative variations on a fresh ad set, kill the worst-CTR ad, and check frequency. If frequency > 2.5× on the same creative, that's the smoking gun.",
    severity,
    metrics: { ctr, impressions: k.impressions, linkClicks: k.linkClicks },
    dedupKey: `${ctx.clientId}:bad_ctr:${ctx.yesterday.date}`,
  };
}

// Dead-creative — impressions delivered but zero clicks.
function ruleDeadCreative(ctx: RuleContext): DetectedAlert | null {
  const k = ctx.yesterday.current;
  if (k.impressions < 500) return null;
  if (k.linkClicks > 0) return null;
  return {
    category: "dead_creative",
    title: "Impressions delivered, zero clicks",
    description: `${k.impressions.toLocaleString()} impressions yesterday with 0 link clicks. The creative is being served but not converting a single viewer to a clicker.`,
    suggestion:
      "This is creative-level. Pause the affected ad and replace it with a tested variation. Check the thumb-stop ratio (3-second video view rate) — if low, the hook is the problem; if high but no clicks, the CTA / offer copy is the problem.",
    severity: "HIGH",
    metrics: { impressions: k.impressions, linkClicks: 0 },
    dedupKey: `${ctx.clientId}:dead_creative:${ctx.yesterday.date}`,
  };
}

// All rules in priority order. Each rule returns null or one alert.
const RULES = [
  ruleDryDay,
  ruleCplSpike,
  ruleCpaSpike,
  ruleBadCtr,
  ruleDeadCreative,
];

export function runRules(ctx: RuleContext): DetectedAlert[] {
  const out: DetectedAlert[] = [];
  for (const rule of RULES) {
    const alert = rule(ctx);
    if (alert) out.push(alert);
  }
  return out;
}
