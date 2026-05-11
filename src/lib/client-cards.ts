import { format, subDays } from "date-fns";

import { prisma } from "@/lib/db";
import { summarizeInsights, type MetaInsightRow } from "@/lib/meta";
import { whereClientInBm } from "@/lib/business-managers";
import type { ClientCard } from "@/app/(app)/clients/clients-grid";

const ISO = "yyyy-MM-dd";

// Loads the per-card data for the clients listing without calling Meta — uses
// only what's already cached in SyncSnapshot. Safe to call from the index page.
export async function loadClientCards(activeBm = "__all__"): Promise<ClientCard[]> {
  const today = new Date();
  const since = format(subDays(today, 29), ISO);
  const until = format(today, ISO);
  const rangeStart = new Date(since + "T00:00:00Z");

  const clients = await prisma.client.findMany({
    where: whereClientInBm(activeBm),
    orderBy: [{ archived: "asc" }, { name: "asc" }],
    include: {
      adAccounts: {
        select: { id: true, currency: true, lastSyncedAt: true },
      },
      orders: {
        where: {
          occurredAt: {
            gte: rangeStart,
            lte: new Date(until + "T23:59:59Z"),
          },
        },
        select: { value: true },
      },
    },
  });

  const accountIds = clients.flatMap((c) => c.adAccounts.map((a) => a.id));
  const snapshots = accountIds.length
    ? await prisma.syncSnapshot.findMany({
        where: {
          adAccountId: { in: accountIds },
          rangeStart: { gte: subDays(rangeStart, 5) },
        },
        orderBy: { takenAt: "desc" },
      })
    : [];

  const latestPerAccount = new Map<string, MetaInsightRow[]>();
  for (const snap of snapshots) {
    if (latestPerAccount.has(snap.adAccountId)) continue;
    const payload = snap.payload as { rows: MetaInsightRow[]; reach?: number };
    latestPerAccount.set(snap.adAccountId, payload.rows ?? []);
  }

  return clients.map((c) => {
    const rows = c.adAccounts.flatMap((a) => latestPerAccount.get(a.id) ?? []);
    const orderRevenue = c.orders.reduce(
      (acc, o) => acc + Number(o.value),
      0,
    );
    const summary = summarizeInsights(rows, {
      backendOrderCount: c.orders.length,
      backendOrderRevenue: orderRevenue,
    });
    const lastSyncedAt = c.adAccounts
      .map((a) => a.lastSyncedAt)
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0]
      ?.toISOString() ?? null;

    // Active campaigns proxy: distinct campaign_ids that drove spend in the
    // cached window. We don't refetch effective_status per card (would be N
    // calls to Meta on the listing page), so this is the closest signal we
    // can give without extra round-trips.
    const activeCampaigns = new Set(
      rows
        .filter((r) => r.campaign_id && Number(r.spend) > 0)
        .map((r) => r.campaign_id),
    ).size;

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      archived: c.archived,
      brandColor: c.brandColor,
      currency: c.adAccounts[0]?.currency ?? "EUR",
      activeCampaigns,
      lastSyncedAt,
      thisMonthSpend: rows.length ? summary.spend : null,
      thisMonthImpressions: rows.length ? summary.impressions : null,
    } satisfies ClientCard;
  });
}
