import { prisma } from "@/lib/db";
import { assembleClientInsights } from "@/lib/insights-assembly";
import { whereClientInBm } from "@/lib/business-managers";
import type { DateRange, KpiSummary } from "@/lib/meta";

export type ClientRollupRow = {
  id: string;
  name: string;
  slug: string;
  archived: boolean;
  brandColor: string | null;
  currency: string;
  spend: number;
  leads: number;
  purchases: number;
  revenue: number;
  roas: number | null;
  cpa: number | null;
  costPerLead: number | null;
  hasGoogle: boolean;
  lastSyncedAt: string | null;
  hasError: boolean;
};

export type TopCampaignRow = {
  campaignId: string;
  campaignName: string;
  clientId: string;
  clientName: string;
  clientSlug: string;
  spend: number;
  leads: number;
  purchases: number;
  revenue: number;
  roas: number | null;
  costPerLead: number | null;
  currency: string;
};

export type DashboardRollup = {
  range: DateRange;
  totals: {
    spend: number;
    leads: number;
    purchases: number;
    revenue: number;
    roas: number | null;
    cpa: number | null;
    costPerLead: number | null;
  };
  daily: Array<{ date: string; spend: number; revenue: number }>;
  clients: ClientRollupRow[];
  topCampaignsBySpend: TopCampaignRow[];
  topCampaignsByRoas: TopCampaignRow[];
  topCampaignsByLeads: TopCampaignRow[];
};

// Sum a per-day series — Meta + Google Ads dailies are summed by date string.
function mergeDaily(
  series: Array<Array<{ date: string; spend: number; revenue: number }>>,
): Array<{ date: string; spend: number; revenue: number }> {
  const byDate = new Map<string, { spend: number; revenue: number }>();
  for (const s of series) {
    for (const row of s) {
      const cur = byDate.get(row.date) ?? { spend: 0, revenue: 0 };
      cur.spend += row.spend;
      cur.revenue += row.revenue;
      byDate.set(row.date, cur);
    }
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}

export async function loadDashboardRollup(
  range: DateRange,
  activeBm = "__all__",
): Promise<DashboardRollup> {
  const baseWhere = { archived: false };
  const bmWhere = whereClientInBm(activeBm);
  const clients = await prisma.client.findMany({
    where:
      Object.keys(bmWhere).length === 0
        ? baseWhere
        : { AND: [baseWhere, bmWhere] },
    include: {
      adAccounts: { select: { currency: true, lastSyncedAt: true } },
    },
    orderBy: { name: "asc" },
  });

  const perClient = await Promise.all(
    clients.map(async (c) => {
      const ins = await assembleClientInsights({
        clientId: c.id,
        range,
      });
      return { client: c, insights: ins };
    }),
  );

  let totalSpend = 0;
  let totalLeads = 0;
  let totalPurchases = 0;
  let totalRevenue = 0;

  const dailySeries: Array<
    Array<{ date: string; spend: number; revenue: number }>
  > = [];

  const allCampaigns: TopCampaignRow[] = [];

  const rows: ClientRollupRow[] = perClient.map(({ client, insights }) => {
    const k: KpiSummary = insights.combined;
    totalSpend += k.spend;
    totalLeads += k.leads;
    totalPurchases += k.purchasesReal;
    totalRevenue += k.revenueReal;
    if (insights.daily.length > 0) {
      dailySeries.push(
        insights.daily.map((d) => ({
          date: d.date,
          spend: d.spend,
          revenue: d.revenue,
        })),
      );
    }
    const lastSyncedAt = client.adAccounts
      .map((a) => a.lastSyncedAt)
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0]
      ?.toISOString() ?? null;

    const currency = client.adAccounts[0]?.currency ?? "EUR";

    for (const c of insights.byCampaign) {
      if (c.spend === 0) continue;
      allCampaigns.push({
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        spend: c.spend,
        leads: c.leads,
        purchases: c.purchasesPixel,
        revenue: c.revenuePixel,
        roas: c.roasPixel,
        costPerLead: c.costPerLead,
        currency,
      });
    }

    return {
      id: client.id,
      name: client.name,
      slug: client.slug,
      archived: client.archived,
      brandColor: client.brandColor,
      currency,
      spend: k.spend,
      leads: k.leads,
      purchases: k.purchasesReal,
      revenue: k.revenueReal,
      roas: k.roasReal,
      cpa: k.cpaReal,
      costPerLead: k.costPerLead,
      hasGoogle: !!insights.google,
      lastSyncedAt,
      hasError: !!insights.error,
    } satisfies ClientRollupRow;
  });

  const topCampaignsBySpend = [...allCampaigns]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);
  // Only include rows that actually have purchase volume — sorting by ROAS
  // among rows with 0 purchases produces meaningless leaderboards.
  const topCampaignsByRoas = allCampaigns
    .filter((c) => c.purchases > 0 && c.roas != null)
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))
    .slice(0, 5);
  const topCampaignsByLeads = allCampaigns
    .filter((c) => c.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5);

  return {
    range,
    totals: {
      spend: totalSpend,
      leads: totalLeads,
      purchases: totalPurchases,
      revenue: totalRevenue,
      roas: totalSpend > 0 ? totalRevenue / totalSpend : null,
      cpa: totalPurchases > 0 ? totalSpend / totalPurchases : null,
      costPerLead: totalLeads > 0 ? totalSpend / totalLeads : null,
    },
    daily: mergeDaily(dailySeries),
    clients: rows.sort((a, b) => b.spend - a.spend),
    topCampaignsBySpend,
    topCampaignsByRoas,
    topCampaignsByLeads,
  };
}
