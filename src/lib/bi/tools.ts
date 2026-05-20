import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Role } from "@prisma/client";

import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { assembleClientInsights } from "@/lib/insights-assembly";
import { loadDashboardRollup } from "@/lib/dashboard-rollup";
import { safeAuditLog } from "@/lib/audit";
import {
  classifyObjective,
  fetchInsights,
  getAdSetStatusMap,
  getCampaignStatusMap,
  isActiveEffectiveStatus,
  setAdSetStatus,
  setCampaignStatus,
  summarizeByAdSet,
  type DateRange,
  type MetaInsightRow,
} from "@/lib/meta";

const ISO = "yyyy-MM-dd";
const RANGE_PRESETS = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "month",
  "last-month",
] as const;
type RangePreset = (typeof RANGE_PRESETS)[number];

function presetToRange(preset: RangePreset): DateRange {
  const today = new Date();
  switch (preset) {
    case "today":
      return { since: format(today, ISO), until: format(today, ISO) };
    case "yesterday": {
      const y = subDays(today, 1);
      return { since: format(y, ISO), until: format(y, ISO) };
    }
    case "7d":
      return {
        since: format(subDays(today, 6), ISO),
        until: format(today, ISO),
      };
    case "30d":
      return {
        since: format(subDays(today, 29), ISO),
        until: format(today, ISO),
      };
    case "month":
      return {
        since: format(startOfMonth(today), ISO),
        until: format(today, ISO),
      };
    case "last-month": {
      const last = subMonths(today, 1);
      return {
        since: format(startOfMonth(last), ISO),
        until: format(endOfMonth(last), ISO),
      };
    }
  }
}

export type ToolContext = {
  userId: string;
  role: Role;
};

export type ToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

// Schema sent to Claude. `set_campaign_status` is filtered out for non-admins
// before this list is sent.
export const READ_TOOLS: ToolDef[] = [
  {
    name: "list_clients",
    description:
      "List every client in the workspace with name, slug, BM name, currency, and last sync timestamp. Use this first when the user asks 'how is X doing?' to find the right slug.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_client_summary",
    description:
      "Get full performance metrics for one client over a date range: spend, leads, cost-per-lead, purchases, revenue, ROAS, CPA, CTR, CPC, CPM, plus the top 5 campaigns by spend with objective tags.",
    input_schema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Client slug (e.g. 'quality-form-sas').",
        },
        range: {
          type: "string",
          enum: [...RANGE_PRESETS],
          description: "Date range preset. Defaults to 30d.",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "list_campaigns",
    description:
      "List every campaign for a client with spend, leads, purchases, ROAS, CPL, and effective_status. Set active_only=true (default) to hide paused/archived.",
    input_schema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        range: { type: "string", enum: [...RANGE_PRESETS] },
        active_only: { type: "boolean" },
      },
      required: ["slug"],
    },
  },
  {
    name: "list_adsets",
    description:
      "List every ad set for a client with spend, impressions, CTR, leads/purchases, ROAS/CPL, and effective_status. Includes the parent campaign name. Use after the user asks about ad-set-level performance, e.g. 'which ad set is wasting budget?'",
    input_schema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        range: { type: "string", enum: [...RANGE_PRESETS] },
        active_only: { type: "boolean" },
      },
      required: ["slug"],
    },
  },
  {
    name: "get_top_campaigns",
    description:
      "Get the top N campaigns ACROSS ALL CLIENTS, ranked by metric (spend, roas, or leads). Each row tags its client name + slug.",
    input_schema: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["spend", "roas", "leads"] },
        n: { type: "integer", minimum: 1, maximum: 20 },
        range: { type: "string", enum: [...RANGE_PRESETS] },
      },
      required: ["metric"],
    },
  },
];

export const ADMIN_TOOLS: ToolDef[] = [
  {
    name: "set_campaign_status",
    description:
      "**ADMIN ONLY · DESTRUCTIVE.** Pauses or activates a Meta campaign. ALWAYS confirm with the user IN PLAIN TEXT before invoking — describe the campaign by name, current spend, and what status you'll set, then wait for explicit 'yes' / 'go' / 'confirma' before calling. Never call this proactively.",
    input_schema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Client slug" },
        campaign_id: {
          type: "string",
          description: "Meta campaign id (numeric string)",
        },
        status: { type: "string", enum: ["ACTIVE", "PAUSED"] },
      },
      required: ["slug", "campaign_id", "status"],
    },
  },
  {
    name: "set_adset_status",
    description:
      "**ADMIN ONLY · DESTRUCTIVE.** Pauses or activates a Meta ad set. Same confirmation rule as set_campaign_status — describe the ad set by name + spend, get a 'yes' from the user, then call.",
    input_schema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Client slug" },
        adset_id: {
          type: "string",
          description: "Meta ad set id (numeric string)",
        },
        status: { type: "string", enum: ["ACTIVE", "PAUSED"] },
      },
      required: ["slug", "adset_id", "status"],
    },
  },
];

export function getToolsForRole(role: Role): ToolDef[] {
  if (role === Role.ADMIN) return [...READ_TOOLS, ...ADMIN_TOOLS];
  return READ_TOOLS;
}

// Tool execution. Each handler returns plain JSON-serializable data; Claude
// will read it and decide how to respond.
export async function runTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  const input = (rawInput ?? {}) as Record<string, unknown>;

  switch (name) {
    case "list_clients":
      return await toolListClients();
    case "get_client_summary":
      return await toolGetClientSummary(
        String(input.slug ?? ""),
        (input.range as RangePreset) ?? "30d",
      );
    case "list_campaigns":
      return await toolListCampaigns(
        String(input.slug ?? ""),
        (input.range as RangePreset) ?? "30d",
        input.active_only !== false,
      );
    case "get_top_campaigns":
      return await toolGetTopCampaigns(
        (input.metric as "spend" | "roas" | "leads") ?? "spend",
        (input.range as RangePreset) ?? "30d",
        Math.max(1, Math.min(20, Number(input.n ?? 5))),
      );
    case "set_campaign_status": {
      if (ctx.role !== Role.ADMIN) {
        return { error: "set_campaign_status is restricted to ADMIN role." };
      }
      return await toolSetCampaignStatus(
        String(input.slug ?? ""),
        String(input.campaign_id ?? ""),
        (input.status as "ACTIVE" | "PAUSED") ?? "PAUSED",
        ctx,
      );
    }
    case "list_adsets":
      return await toolListAdSets(
        String(input.slug ?? ""),
        (input.range as RangePreset) ?? "30d",
        input.active_only !== false,
      );
    case "set_adset_status": {
      if (ctx.role !== Role.ADMIN) {
        return { error: "set_adset_status is restricted to ADMIN role." };
      }
      return await toolSetAdSetStatus(
        String(input.slug ?? ""),
        String(input.adset_id ?? ""),
        (input.status as "ACTIVE" | "PAUSED") ?? "PAUSED",
        ctx,
      );
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function toolListClients() {
  const clients = await prisma.client.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    select: {
      name: true,
      slug: true,
      adAccounts: {
        select: {
          metaAccountId: true,
          businessName: true,
          currency: true,
          lastSyncedAt: true,
          channel: true,
        },
      },
    },
  });
  return clients.map((c) => ({
    name: c.name,
    slug: c.slug,
    bm: c.adAccounts.find((a) => a.channel === "META")?.businessName ?? null,
    currency: c.adAccounts[0]?.currency ?? "EUR",
    last_synced_at:
      c.adAccounts
        .map((a) => a.lastSyncedAt)
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0]
        ?.toISOString() ?? null,
  }));
}

async function toolGetClientSummary(slug: string, preset: RangePreset) {
  const client = await prisma.client.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!client) return { error: `No client found with slug "${slug}".` };

  const range = presetToRange(preset);
  const [insights, statusMap] = await Promise.all([
    assembleClientInsights({ clientId: client.id, range }),
    getCampaignStatusMap(client.id),
  ]);
  const k = insights.combined;

  const topCampaigns = insights.byCampaign
    .filter((b) => b.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5)
    .map((c) => {
      const meta = statusMap.get(c.campaignId);
      return {
        campaign_id: c.campaignId,
        name: c.campaignName,
        objective: classifyObjective(meta?.objective),
        effective_status: meta?.effectiveStatus ?? "unknown",
        spend: round2(c.spend),
        leads: c.leads,
        cost_per_lead: round2(c.costPerLead),
        purchases: c.purchasesPixel,
        roas: round2(c.roasPixel),
      };
    });

  return {
    client: client.name,
    slug,
    range,
    spend: round2(k.spend),
    impressions: k.impressions,
    reach: k.reach,
    leads: k.leads,
    cost_per_lead: round2(k.costPerLead),
    purchases_real: k.purchasesReal,
    revenue_real: round2(k.revenueReal),
    roas_real: round2(k.roasReal),
    cpa_real: round2(k.cpaReal),
    ctr_link_pct: k.ctrLink != null ? round2(k.ctrLink * 100) : null,
    cpc_link: round2(k.cpcLink),
    cpm: round2(k.cpm),
    sync_error: insights.error,
    top_campaigns: topCampaigns,
  };
}

async function toolListCampaigns(
  slug: string,
  preset: RangePreset,
  activeOnly: boolean,
) {
  const client = await prisma.client.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!client) return { error: `No client found with slug "${slug}".` };

  const range = presetToRange(preset);
  const [insights, statusMap] = await Promise.all([
    assembleClientInsights({ clientId: client.id, range }),
    getCampaignStatusMap(client.id),
  ]);

  const all = insights.byCampaign.map((c) => {
    const meta = statusMap.get(c.campaignId);
    return {
      campaign_id: c.campaignId,
      name: c.campaignName,
      objective: classifyObjective(meta?.objective),
      effective_status: meta?.effectiveStatus ?? "unknown",
      spend: round2(c.spend),
      impressions: c.impressions,
      link_clicks: c.linkClicks,
      leads: c.leads,
      cost_per_lead: round2(c.costPerLead),
      purchases: c.purchasesPixel,
      revenue: round2(c.revenuePixel),
      roas: round2(c.roasPixel),
      ctr_pct: c.ctrLink != null ? round2(c.ctrLink * 100) : null,
    };
  });

  return {
    client: client.name,
    slug,
    range,
    campaigns: activeOnly
      ? all.filter((c) => isActiveEffectiveStatus(c.effective_status))
      : all,
  };
}

async function toolGetTopCampaigns(
  metric: "spend" | "roas" | "leads",
  preset: RangePreset,
  n: number,
) {
  const range = presetToRange(preset);
  const rollup = await loadDashboardRollup(range);
  const list =
    metric === "spend"
      ? rollup.topCampaignsBySpend
      : metric === "roas"
        ? rollup.topCampaignsByRoas
        : rollup.topCampaignsByLeads;
  return list.slice(0, n).map((c) => ({
    campaign_id: c.campaignId,
    name: c.campaignName,
    client: c.clientName,
    client_slug: c.clientSlug,
    spend: round2(c.spend),
    leads: c.leads,
    cost_per_lead: round2(c.costPerLead),
    purchases: c.purchases,
    revenue: round2(c.revenue),
    roas: round2(c.roas),
    currency: c.currency,
  }));
}

async function toolSetCampaignStatus(
  slug: string,
  campaignId: string,
  status: "ACTIVE" | "PAUSED",
  ctx: ToolContext,
) {
  const client = await prisma.client.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      adAccounts: {
        where: { channel: "META" },
        select: { metaAccountId: true, accessTokenEnc: true, id: true },
      },
    },
  });
  if (!client) return { error: `No client found with slug "${slug}".` };
  if (client.adAccounts.length === 0) {
    return { error: `${client.name} has no Meta ad account connected.` };
  }

  // Try each connected ad account until one accepts the campaign id (since we
  // don't track campaign→adAccount mapping in our DB, only globally).
  let lastErr: unknown = null;
  for (const account of client.adAccounts) {
    try {
      const token = decryptToken(account.accessTokenEnc);
      await setCampaignStatus({
        campaignId,
        accessToken: token,
        status,
        bucketKey: `${account.id}:edit`,
      });
      await safeAuditLog({
        userId: ctx.userId,
        action: "campaign.setStatus",
        meta: {
          clientSlug: slug,
          campaignId,
          status,
          adAccountId: account.id,
        },
      });
      return {
        ok: true,
        client: client.name,
        campaign_id: campaignId,
        new_status: status,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  return {
    error:
      lastErr instanceof Error
        ? lastErr.message
        : "Failed to update campaign status.",
  };
}

async function toolListAdSets(
  slug: string,
  preset: RangePreset,
  activeOnly: boolean,
) {
  const client = await prisma.client.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      adAccounts: {
        where: { channel: "META" },
        select: { metaAccountId: true, accessTokenEnc: true, id: true },
      },
    },
  });
  if (!client) return { error: `No client found with slug "${slug}".` };
  if (client.adAccounts.length === 0) {
    return { error: `${client.name} has no Meta ad account connected.` };
  }
  const range = presetToRange(preset);

  // Ad-set insights are live-fetched per account (no snapshot cache).
  const liveRows: MetaInsightRow[] = [];
  for (const account of client.adAccounts) {
    try {
      const token = decryptToken(account.accessTokenEnc);
      const rows = await fetchInsights({
        metaAccountId: account.metaAccountId,
        accessToken: token,
        range,
        level: "adset",
        bucketKey: `${account.id}:adset-insights:bi`,
      });
      liveRows.push(...rows);
    } catch {
      // ignore per-account failures
    }
  }

  const statusMap = await getAdSetStatusMap(client.id);
  const summary = summarizeByAdSet(liveRows);
  const all = summary.map((s) => {
    const meta = statusMap.get(s.adsetId);
    return {
      adset_id: s.adsetId,
      name: s.adsetName,
      campaign: s.campaignName,
      effective_status: meta?.effectiveStatus ?? "unknown",
      daily_budget: meta?.dailyBudget ?? null,
      spend: round2(s.spend),
      impressions: s.impressions,
      ctr_pct: s.ctrLink != null ? round2(s.ctrLink * 100) : null,
      leads: s.leads,
      cost_per_lead: round2(s.costPerLead),
      purchases: s.purchasesPixel,
      roas: round2(s.roasPixel),
    };
  });
  return {
    client: client.name,
    slug,
    range,
    adsets: activeOnly
      ? all.filter((a) => isActiveEffectiveStatus(a.effective_status))
      : all,
  };
}

async function toolSetAdSetStatus(
  slug: string,
  adSetId: string,
  status: "ACTIVE" | "PAUSED",
  ctx: ToolContext,
) {
  const client = await prisma.client.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      adAccounts: {
        where: { channel: "META" },
        select: { metaAccountId: true, accessTokenEnc: true, id: true },
      },
    },
  });
  if (!client) return { error: `No client found with slug "${slug}".` };
  if (client.adAccounts.length === 0) {
    return { error: `${client.name} has no Meta ad account connected.` };
  }
  let lastErr: unknown = null;
  for (const account of client.adAccounts) {
    try {
      const token = decryptToken(account.accessTokenEnc);
      await setAdSetStatus({
        adSetId,
        accessToken: token,
        status,
        bucketKey: `${account.id}:adset-edit`,
      });
      await safeAuditLog({
        userId: ctx.userId,
        action: "adset.setStatus",
        meta: { clientSlug: slug, adSetId, status, adAccountId: account.id },
      });
      return {
        ok: true,
        client: client.name,
        adset_id: adSetId,
        new_status: status,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  return {
    error:
      lastErr instanceof Error
        ? lastErr.message
        : "Failed to update ad set status.",
  };
}

function round2(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
