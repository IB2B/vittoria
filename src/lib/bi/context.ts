import { format, subDays } from "date-fns";

import { prisma } from "@/lib/db";
import { assembleClientInsights } from "@/lib/insights-assembly";
import { classifyObjective, getCampaignStatusMap } from "@/lib/meta";
import type { DateRange } from "@/lib/meta";

const ISO = "yyyy-MM-dd";

// Builds a compact markdown snapshot of every client + their key metrics
// for the last 30 days. Intentionally terse — Claude doesn't need prose, it
// needs numbers it can quote. Output is what we feed into the chat's system
// prompt. Cached snapshots are reused; no Meta calls happen here.
export async function buildBiContext(): Promise<string> {
  const today = new Date();
  const range: DateRange = {
    since: format(subDays(today, 29), ISO),
    until: format(today, ISO),
  };

  const clients = await prisma.client.findMany({
    where: { archived: false },
    select: { id: true, name: true, slug: true, adAccounts: { select: { businessName: true, currency: true } } },
    orderBy: { name: "asc" },
  });

  if (clients.length === 0) {
    return "No clients connected yet.";
  }

  const sections: string[] = [];
  sections.push(
    `# Workspace snapshot — last 30 days (${range.since} → ${range.until})\n`,
  );
  sections.push(`Total clients: **${clients.length}**\n`);

  for (const c of clients) {
    let insights;
    let statusMap;
    try {
      [insights, statusMap] = await Promise.all([
        assembleClientInsights({ clientId: c.id, range }),
        getCampaignStatusMap(c.id),
      ]);
    } catch (err) {
      sections.push(
        `\n## ${c.name}\n*Error loading insights: ${err instanceof Error ? err.message : "unknown"}*\n`,
      );
      continue;
    }

    const k = insights.combined;
    const currency = c.adAccounts[0]?.currency ?? "EUR";
    const bm = c.adAccounts[0]?.businessName ?? "—";

    const lines: string[] = [];
    lines.push(`\n## ${c.name}`);
    lines.push(`- BM: ${bm} · slug: \`${c.slug}\` · currency: ${currency}`);
    lines.push(
      `- Spend: ${currency} ${k.spend.toFixed(2)} · Impressions: ${k.impressions.toLocaleString()} · Reach: ${k.reach.toLocaleString()}`,
    );
    lines.push(
      `- Leads: ${k.leads}${k.costPerLead != null ? ` (CPL ${currency} ${k.costPerLead.toFixed(2)})` : ""}`,
    );
    lines.push(
      `- Purchases: ${k.purchasesReal} · Revenue: ${currency} ${k.revenueReal.toFixed(2)}${k.roasReal != null ? ` · ROAS ${k.roasReal.toFixed(2)}×` : ""}${k.cpaReal != null ? ` · CPA ${currency} ${k.cpaReal.toFixed(2)}` : ""}`,
    );
    lines.push(
      `- CTR (link): ${k.ctrLink != null ? (k.ctrLink * 100).toFixed(2) + "%" : "—"} · CPC: ${k.cpcLink != null ? currency + " " + k.cpcLink.toFixed(2) : "—"} · CPM: ${k.cpm != null ? currency + " " + k.cpm.toFixed(2) : "—"}`,
    );

    // Top 3 campaigns by spend, with objective tag.
    const top = insights.byCampaign
      .filter((b) => b.spend > 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 3);
    if (top.length > 0) {
      lines.push(`- Top campaigns by spend:`);
      for (const cam of top) {
        const meta = statusMap.get(cam.campaignId);
        const kind = classifyObjective(meta?.objective);
        const status = meta?.effectiveStatus ?? "unknown";
        const tail =
          kind === "leads"
            ? ` — ${cam.leads} leads${cam.costPerLead != null ? `, CPL ${cam.costPerLead.toFixed(2)}` : ""}`
            : ` — ${cam.purchasesPixel} purchases${cam.roasPixel != null ? `, ROAS ${cam.roasPixel.toFixed(2)}×` : ""}`;
        lines.push(
          `  - ${cam.campaignName} · ${currency} ${cam.spend.toFixed(2)} · ${kind} · ${status}${tail}`,
        );
      }
    }

    sections.push(lines.join("\n"));
  }

  return sections.join("\n");
}
