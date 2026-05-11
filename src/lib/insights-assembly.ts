import type { Channel } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  dailyTimeSeries,
  getInsights,
  summarizeByCampaign,
  summarizeInsights,
  type DateRange,
  type KpiSummary,
  type MetaInsightRow,
} from "@/lib/meta";
import { previousRange } from "@/lib/date-range";

export type ChannelSummary = {
  channel: Channel;
  current: KpiSummary;
  prior: KpiSummary;
  takenAt: Date | null;
  fromCache: boolean;
  error: string | null;
};

export type ClientInsights = {
  range: DateRange;
  previous: DateRange;
  combined: KpiSummary;
  combinedPrior: KpiSummary;
  daily: ReturnType<typeof dailyTimeSeries>;
  byCampaign: Array<
    {
      campaignId: string;
      campaignName: string;
    } & KpiSummary
  >;
  meta: ChannelSummary;
  google: ChannelSummary | null;
  takenAt: Date | null;
  fromCache: boolean;
  error: string | null;
};

const EMPTY_SUMMARY: KpiSummary = summarizeInsights([], {});

// Sum two summaries together; recompute the ratios at the end. This is what we
// show as "All channels combined" at the top of the per-client overview.
function combine(...parts: KpiSummary[]): KpiSummary {
  const acc: KpiSummary = { ...EMPTY_SUMMARY };
  for (const p of parts) {
    acc.spend += p.spend;
    acc.impressions += p.impressions;
    acc.reach += p.reach;
    acc.linkClicks += p.linkClicks;
    acc.landingPageViews += p.landingPageViews;
    acc.addToCart += p.addToCart;
    acc.initiateCheckout += p.initiateCheckout;
    acc.leads += p.leads;
    acc.purchasesPixel += p.purchasesPixel;
    acc.revenuePixel += p.revenuePixel;
    acc.purchasesReal += p.purchasesReal;
    acc.revenueReal += p.revenueReal;
  }
  acc.frequency = acc.reach > 0 ? acc.impressions / acc.reach : null;
  acc.cpm = acc.impressions > 0 ? (acc.spend / acc.impressions) * 1000 : null;
  acc.cpcLink = acc.linkClicks > 0 ? acc.spend / acc.linkClicks : null;
  acc.ctrLink = acc.impressions > 0 ? acc.linkClicks / acc.impressions : null;
  acc.costPerLpv =
    acc.landingPageViews > 0 ? acc.spend / acc.landingPageViews : null;
  acc.costPerLead = acc.leads > 0 ? acc.spend / acc.leads : null;
  acc.cpaPixel = acc.purchasesPixel > 0 ? acc.spend / acc.purchasesPixel : null;
  acc.roasPixel = acc.spend > 0 ? acc.revenuePixel / acc.spend : null;
  acc.cpaReal = acc.purchasesReal > 0 ? acc.spend / acc.purchasesReal : null;
  acc.roasReal = acc.spend > 0 ? acc.revenueReal / acc.spend : null;
  return acc;
}

// Convert manually-entered ChannelStat rows (Google Ads MVP) into a KpiSummary
// shape so the dashboard can render them next to Meta without special-casing.
async function googleSummaryForRange(
  clientId: string,
  range: DateRange,
): Promise<KpiSummary | null> {
  const rangeStart = new Date(range.since + "T00:00:00Z");
  const rangeEnd = new Date(range.until + "T23:59:59Z");

  const stats = await prisma.channelStat.findMany({
    where: {
      clientId,
      channel: "GOOGLE",
      // overlap test: stat.start <= rangeEnd AND stat.end >= rangeStart
      AND: [
        { rangeStart: { lte: rangeEnd } },
        { rangeEnd: { gte: rangeStart } },
      ],
    },
  });
  if (stats.length === 0) return null;

  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let conversions = 0;
  let revenue = 0;
  for (const s of stats) {
    spend += Number(s.spend);
    impressions += s.impressions;
    clicks += s.clicks;
    conversions += s.conversions;
    revenue += Number(s.revenue);
  }

  const summary: KpiSummary = { ...EMPTY_SUMMARY };
  summary.spend = spend;
  summary.impressions = impressions;
  summary.linkClicks = clicks;
  summary.purchasesPixel = conversions;
  summary.purchasesReal = conversions;
  summary.revenuePixel = revenue;
  summary.revenueReal = revenue;
  summary.cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
  summary.cpcLink = clicks > 0 ? spend / clicks : null;
  summary.ctrLink = impressions > 0 ? clicks / impressions : null;
  summary.cpaPixel = conversions > 0 ? spend / conversions : null;
  summary.roasPixel = spend > 0 ? revenue / spend : null;
  summary.cpaReal = summary.cpaPixel;
  summary.roasReal = summary.roasPixel;
  return summary;
}

export async function assembleClientInsights({
  clientId,
  range,
}: {
  clientId: string;
  range: DateRange;
}): Promise<ClientInsights> {
  const previous = previousRange(range);

  const [accounts, orderTotals, googleCurrent, googlePrior] = await Promise.all([
    prisma.adAccount.findMany({
      where: { clientId, channel: "META" },
      select: { id: true },
    }),
    prisma.order.aggregate({
      where: {
        clientId,
        occurredAt: {
          gte: new Date(range.since + "T00:00:00Z"),
          lte: new Date(range.until + "T23:59:59Z"),
        },
      },
      _sum: { value: true },
      _count: true,
    }),
    googleSummaryForRange(clientId, range),
    googleSummaryForRange(clientId, previous),
  ]);

  const allCurrent: MetaInsightRow[] = [];
  const allPrior: MetaInsightRow[] = [];
  let totalReach = 0;
  let mostRecent: Date | null = null;
  let allFromCache = true;
  let firstError: string | null = null;

  for (const account of accounts) {
    try {
      const [curr, prev] = await Promise.all([
        getInsights({ adAccountId: account.id, range }),
        getInsights({ adAccountId: account.id, range: previous }),
      ]);
      allCurrent.push(...curr.rows);
      allPrior.push(...prev.rows);
      totalReach += curr.reach;
      if (!curr.fromCache || !prev.fromCache) allFromCache = false;
      if (!mostRecent || curr.takenAt > mostRecent) mostRecent = curr.takenAt;
    } catch (err) {
      firstError ??= err instanceof Error ? err.message : "Sync error";
    }
  }

  const backendOrderRevenue = Number(orderTotals._sum.value ?? 0);
  const backendOrderCount = orderTotals._count;

  const metaCurrent = summarizeInsights(allCurrent, {
    accountReach: totalReach,
    backendOrderCount,
    backendOrderRevenue,
  });
  const metaPrior = summarizeInsights(allPrior, {});

  const meta: ChannelSummary = {
    channel: "META",
    current: metaCurrent,
    prior: metaPrior,
    takenAt: mostRecent,
    fromCache: allFromCache,
    error: firstError,
  };

  const google: ChannelSummary | null = googleCurrent
    ? {
        channel: "GOOGLE",
        current: googleCurrent,
        prior: googlePrior ?? EMPTY_SUMMARY,
        takenAt: null,
        fromCache: true,
        error: null,
      }
    : null;

  const combined = google
    ? combine(metaCurrent, google.current)
    : metaCurrent;
  const combinedPrior = google
    ? combine(metaPrior, google.prior)
    : metaPrior;

  return {
    range,
    previous,
    combined,
    combinedPrior,
    daily: dailyTimeSeries(allCurrent),
    byCampaign: summarizeByCampaign(allCurrent),
    meta,
    google,
    takenAt: mostRecent,
    fromCache: allFromCache,
    error: firstError,
  };
}
