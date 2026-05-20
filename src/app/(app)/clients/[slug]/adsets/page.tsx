import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdSetsTable } from "@/components/adsets-table";
import { requireUser } from "@/lib/auth-helpers";
import { getClientForUser } from "@/lib/clients";
import { parseRangeFromSearchParams } from "@/lib/date-range";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import {
  fetchInsights,
  getAdSetStatusMap,
  isActiveEffectiveStatus,
  summarizeByAdSet,
} from "@/lib/meta";
import type { MetaInsightRow } from "@/lib/meta";

export default async function AdsetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const client = await getClientForUser(slug, user);

  const { range } = parseRangeFromSearchParams({
    preset: typeof sp.preset === "string" ? sp.preset : undefined,
    from: typeof sp.from === "string" ? sp.from : undefined,
    to: typeof sp.to === "string" ? sp.to : undefined,
  });

  const statusFilter =
    typeof sp.status === "string" && sp.status === "all" ? "all" : "active";

  // Ad-set-level insights aren't cached (the SyncSnapshot tracks campaign-
  // level only). We do a live fetch per connected META ad account. Page-
  // level loading.tsx covers the wait.
  const accounts = await prisma.adAccount.findMany({
    where: { clientId: client.id, channel: "META" },
    select: {
      id: true,
      metaAccountId: true,
      accessTokenEnc: true,
      currency: true,
    },
  });

  const liveRows: MetaInsightRow[] = [];
  let firstError: string | null = null;
  for (const account of accounts) {
    try {
      const token = decryptToken(account.accessTokenEnc);
      const rows = await fetchInsights({
        metaAccountId: account.metaAccountId,
        accessToken: token,
        range,
        level: "adset",
        bucketKey: `${account.id}:adset-insights`,
      });
      liveRows.push(...rows);
    } catch (err) {
      firstError ??=
        err instanceof Error ? err.message : "Failed to fetch ad sets";
    }
  }

  const statusMap = await getAdSetStatusMap(client.id);
  const currency = accounts[0]?.currency ?? "EUR";
  const summary = summarizeByAdSet(liveRows);

  const allRows = summary.map((s) => {
    const meta = statusMap.get(s.adsetId);
    return {
      adsetId: s.adsetId,
      adsetName: s.adsetName,
      campaignName: s.campaignName,
      effectiveStatus: meta?.effectiveStatus,
      dailyBudget: meta?.dailyBudget,
      spend: s.spend,
      impressions: s.impressions,
      linkClicks: s.linkClicks,
      ctrLink: s.ctrLink,
      leads: s.leads,
      costPerLead: s.costPerLead,
      purchasesPixel: s.purchasesPixel,
      roasPixel: s.roasPixel,
    };
  });

  const activeOnly = statusFilter === "active";
  const visibleRows = activeOnly
    ? allRows.filter((r) =>
        r.effectiveStatus ? isActiveEffectiveStatus(r.effectiveStatus) : false,
      )
    : allRows;
  const hiddenCount = allRows.length - visibleRows.length;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">
          {activeOnly ? "Active ad sets" : "All ad sets"}
        </CardTitle>
        <CardDescription>
          {range.since} → {range.until}
          {activeOnly && hiddenCount > 0 ? (
            <>
              {" · "}
              <span className="text-muted-foreground">
                {hiddenCount} paused/archived hidden
              </span>
            </>
          ) : null}
          {firstError ? (
            <>
              {" · "}
              <span className="text-destructive">{firstError}</span>
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AdSetsTable
          rows={visibleRows}
          currency={currency}
          clientId={client.id}
          slug={slug}
          canToggle={user.role === "ADMIN"}
        />
      </CardContent>
    </Card>
  );
}
