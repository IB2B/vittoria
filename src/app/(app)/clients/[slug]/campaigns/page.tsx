import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CampaignsTable } from "@/components/campaigns-table";
import { requireUser } from "@/lib/auth-helpers";
import { getClientForUser } from "@/lib/clients";
import { parseRangeFromSearchParams } from "@/lib/date-range";
import { assembleClientInsights } from "@/lib/insights-assembly";
import {
  classifyObjective,
  getCampaignStatusMap,
  isActiveEffectiveStatus,
} from "@/lib/meta";

export default async function CampaignsPage({
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

  const [insights, statusMap] = await Promise.all([
    assembleClientInsights({ clientId: client.id, range }),
    getCampaignStatusMap(client.id),
  ]);

  const currency = client.adAccounts[0]?.currency ?? "EUR";

  const allRows = insights.byCampaign.map((c) => {
    const meta = statusMap.get(c.campaignId);
    return {
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      effectiveStatus: meta?.effectiveStatus,
      objectiveKind: classifyObjective(meta?.objective),
      spend: c.spend,
      impressions: c.impressions,
      linkClicks: c.linkClicks,
      ctrLink: c.ctrLink,
      cpcLink: c.cpcLink,
      leads: c.leads,
      costPerLead: c.costPerLead,
      purchasesPixel: c.purchasesPixel,
      revenuePixel: c.revenuePixel,
      cpaPixel: c.cpaPixel,
      roasPixel: c.roasPixel,
    };
  });

  const activeOnly = statusFilter === "active";
  const visibleRows = activeOnly
    ? allRows.filter((r) =>
        r.effectiveStatus
          ? isActiveEffectiveStatus(r.effectiveStatus)
          : false,
      )
    : allRows;

  const hiddenCount = allRows.length - visibleRows.length;
  const qs = new URLSearchParams();
  if (typeof sp.preset === "string") qs.set("preset", sp.preset);
  if (typeof sp.from === "string") qs.set("from", sp.from);
  if (typeof sp.to === "string") qs.set("to", sp.to);
  const toggleHref = (() => {
    const next = new URLSearchParams(qs);
    if (activeOnly) next.set("status", "all");
    else next.delete("status");
    const s = next.toString();
    return `/clients/${slug}/campaigns${s ? `?${s}` : ""}`;
  })();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">
            {activeOnly ? "Active campaigns" : "All campaigns"}
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
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={toggleHref} />}
        >
          {activeOnly ? "Show paused/archived" : "Active only"}
        </Button>
      </CardHeader>
      <CardContent>
        <CampaignsTable rows={visibleRows} currency={currency} />
      </CardContent>
    </Card>
  );
}
