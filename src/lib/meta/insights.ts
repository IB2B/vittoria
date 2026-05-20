import type { MetaInsightRow, MetaPaging } from "./types";
import { metaGetAllPages } from "./client";

export const INSIGHT_FIELDS = [
  "campaign_name",
  "campaign_id",
  "spend",
  "reach",
  "frequency",
  "impressions",
  "cpm",
  "clicks",
  "cpc",
  "ctr",
  "inline_link_clicks",
  "cost_per_inline_link_click",
  "inline_link_click_ctr",
  "actions",
  "action_values",
  "purchase_roas",
  "cost_per_action_type",
  "date_start",
  "date_stop",
] as const;

export type DateRange = {
  since: string; // YYYY-MM-DD
  until: string;
};

export type InsightLevel = "account" | "campaign" | "adset" | "ad";

export type FetchInsightsOptions = {
  metaAccountId: string;
  accessToken: string;
  range: DateRange;
  level: InsightLevel;
  timeIncrement?: number | "all_days";
  bucketKey?: string;
};

export async function fetchInsights({
  metaAccountId,
  accessToken,
  range,
  level,
  timeIncrement = 1,
  bucketKey,
}: FetchInsightsOptions): Promise<MetaInsightRow[]> {
  const path = `${metaAccountId}/insights`;
  return metaGetAllPages<MetaInsightRow>(
    path,
    {
      level,
      time_range: JSON.stringify({ since: range.since, until: range.until }),
      time_increment: String(timeIncrement),
      fields: INSIGHT_FIELDS as unknown as string[],
      limit: 250,
    },
    { accessToken, bucketKey },
  );
}

// Reach is a unique-user metric — only meaningful at the account level for the
// whole window (Meta returns wrong numbers if you sum daily reach).
export async function fetchAccountReach({
  metaAccountId,
  accessToken,
  range,
  bucketKey,
}: Pick<
  FetchInsightsOptions,
  "metaAccountId" | "accessToken" | "range" | "bucketKey"
>): Promise<number> {
  const rows = await fetchInsights({
    metaAccountId,
    accessToken,
    range,
    level: "account",
    timeIncrement: "all_days",
    bucketKey,
  });
  const reach = rows[0]?.reach;
  return reach ? Number(reach) : 0;
}

// --- KPI math --- per §14 of the spec ---
//
// IMPORTANT: Meta returns multiple aliases for the same logical conversion.
// e.g. a single lead-form submission can come back as BOTH `lead` and
// `onsite_conversion.lead_grouped`, with identical values — summing both
// double-counts. Likewise `purchase` and `offsite_conversion.fb_pixel_purchase`
// often overlap. We solve this by picking the FIRST-matching alias per row in
// a priority order, instead of summing everything that matches.

// Most specific → least specific. The first hit per row wins.
const PURCHASE_PRIORITY = [
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "purchase",
];

const LANDING_PAGE_VIEW_PRIORITY = ["landing_page_view"];

const ADD_TO_CART_PRIORITY = [
  "offsite_conversion.fb_pixel_add_to_cart",
  "omni_add_to_cart",
  "add_to_cart",
];

const INITIATE_CHECKOUT_PRIORITY = [
  "offsite_conversion.fb_pixel_initiate_checkout",
  "omni_initiated_checkout",
  "initiate_checkout",
];

// Onsite-grouped covers Meta instant-form leads (the modern lead-gen flow),
// pixel covers external-form leads. Generic `lead` is the legacy umbrella that
// duplicates the others — last in priority so it's only used as a fallback.
const LEAD_PRIORITY = [
  "onsite_conversion.lead_grouped",
  "onsite_conversion.lead_form_submitted",
  "offsite_conversion.fb_pixel_lead",
  "lead",
];

export type CampaignObjectiveKind = "leads" | "sales" | "other";

export function classifyObjective(
  objective: string | null | undefined,
): CampaignObjectiveKind {
  if (!objective) return "other";
  const o = objective.toUpperCase();
  if (o === "OUTCOME_LEADS" || o === "LEAD_GENERATION") return "leads";
  if (
    o === "OUTCOME_SALES" ||
    o === "CONVERSIONS" ||
    o === "PRODUCT_CATALOG_SALES"
  ) {
    return "sales";
  }
  return "other";
}

// Picks the FIRST matching alias per row from `priority` and sums those values
// across rows. This avoids double-counting when Meta returns multiple aliases
// for the same logical conversion (the cause of the leads "6 instead of 3" bug).
function sumActionsByPriority(
  rows: MetaInsightRow[],
  field: "actions" | "action_values",
  priority: string[],
): number {
  let total = 0;
  for (const row of rows) {
    const stats = row[field];
    if (!stats || stats.length === 0) continue;
    for (const type of priority) {
      const match = stats.find((s) => s.action_type === type);
      if (match) {
        total += Number(match.value) || 0;
        break;
      }
    }
  }
  return total;
}

export type KpiSummary = {
  spend: number;
  impressions: number;
  reach: number;
  frequency: number | null;
  cpm: number | null;
  linkClicks: number;
  cpcLink: number | null;
  ctrLink: number | null;
  landingPageViews: number;
  costPerLpv: number | null;
  addToCart: number;
  initiateCheckout: number;
  leads: number;
  costPerLead: number | null;
  purchasesPixel: number;
  revenuePixel: number;
  cpaPixel: number | null;
  roasPixel: number | null;
  // "Real" variants include manually-recorded backend orders (set by caller).
  purchasesReal: number;
  revenueReal: number;
  cpaReal: number | null;
  roasReal: number | null;
};

export function summarizeInsights(
  rows: MetaInsightRow[],
  options: {
    accountReach?: number;
    backendOrderCount?: number;
    backendOrderRevenue?: number;
  } = {},
): KpiSummary {
  const spend = rows.reduce((acc, r) => acc + (Number(r.spend) || 0), 0);
  const impressions = rows.reduce(
    (acc, r) => acc + (Number(r.impressions) || 0),
    0,
  );
  const reach = options.accountReach ?? 0;
  const linkClicks = rows.reduce(
    (acc, r) => acc + (Number(r.inline_link_clicks) || 0),
    0,
  );
  const landingPageViews = sumActionsByPriority(
    rows,
    "actions",
    LANDING_PAGE_VIEW_PRIORITY,
  );
  const addToCart = sumActionsByPriority(rows, "actions", ADD_TO_CART_PRIORITY);
  const initiateCheckout = sumActionsByPriority(
    rows,
    "actions",
    INITIATE_CHECKOUT_PRIORITY,
  );
  const purchasesPixel = sumActionsByPriority(
    rows,
    "actions",
    PURCHASE_PRIORITY,
  );
  const revenuePixel = sumActionsByPriority(
    rows,
    "action_values",
    PURCHASE_PRIORITY,
  );
  const leads = sumActionsByPriority(rows, "actions", LEAD_PRIORITY);

  const purchasesReal = purchasesPixel + (options.backendOrderCount ?? 0);
  const revenueReal = revenuePixel + (options.backendOrderRevenue ?? 0);

  return {
    spend,
    impressions,
    reach,
    frequency: reach > 0 ? impressions / reach : null,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
    linkClicks,
    cpcLink: linkClicks > 0 ? spend / linkClicks : null,
    ctrLink: impressions > 0 ? linkClicks / impressions : null,
    landingPageViews,
    costPerLpv: landingPageViews > 0 ? spend / landingPageViews : null,
    addToCart,
    initiateCheckout,
    leads,
    costPerLead: leads > 0 ? spend / leads : null,
    purchasesPixel,
    revenuePixel,
    cpaPixel: purchasesPixel > 0 ? spend / purchasesPixel : null,
    roasPixel: spend > 0 ? revenuePixel / spend : null,
    purchasesReal,
    revenueReal,
    cpaReal: purchasesReal > 0 ? spend / purchasesReal : null,
    roasReal: spend > 0 ? revenueReal / spend : null,
  };
}

export function summarizeByAdSet(
  rows: MetaInsightRow[],
): Array<
  KpiSummary & {
    adsetId: string;
    adsetName: string;
    campaignId?: string;
    campaignName?: string;
  }
> {
  const buckets = new Map<string, MetaInsightRow[]>();
  for (const row of rows) {
    const id = row.adset_id ?? "";
    if (!id) continue;
    const list = buckets.get(id) ?? [];
    list.push(row);
    buckets.set(id, list);
  }
  return Array.from(buckets.entries()).map(([adsetId, group]) => {
    const summary = summarizeInsights(group);
    return {
      adsetId,
      adsetName: group[0]?.adset_name ?? adsetId,
      campaignId: group[0]?.campaign_id,
      campaignName: group[0]?.campaign_name,
      ...summary,
    };
  });
}

export function summarizeByCampaign(
  rows: MetaInsightRow[],
): Array<KpiSummary & { campaignId: string; campaignName: string }> {
  const buckets = new Map<string, MetaInsightRow[]>();
  for (const row of rows) {
    const id = row.campaign_id ?? "";
    if (!id) continue;
    const list = buckets.get(id) ?? [];
    list.push(row);
    buckets.set(id, list);
  }
  return Array.from(buckets.entries()).map(([campaignId, group]) => {
    const summary = summarizeInsights(group);
    return {
      campaignId,
      campaignName: group[0]?.campaign_name ?? campaignId,
      ...summary,
    };
  });
}

export function dailyTimeSeries(
  rows: MetaInsightRow[],
): Array<{ date: string; spend: number; revenue: number; purchases: number }> {
  const byDay = new Map<
    string,
    { spend: number; revenue: number; purchases: number }
  >();
  for (const row of rows) {
    const day = row.date_start;
    if (!day) continue;
    const bucket = byDay.get(day) ?? { spend: 0, revenue: 0, purchases: 0 };
    bucket.spend += Number(row.spend) || 0;
    bucket.revenue += sumActionsByPriority(
      [row],
      "action_values",
      PURCHASE_PRIORITY,
    );
    bucket.purchases += sumActionsByPriority(
      [row],
      "actions",
      PURCHASE_PRIORITY,
    );
    byDay.set(day, bucket);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }));
}

export type _PageType = MetaPaging<MetaInsightRow>;
