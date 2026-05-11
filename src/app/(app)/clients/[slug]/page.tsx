import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CampaignsTable } from "@/components/campaigns-table";
import { ChannelKpiPanel } from "@/components/channel-kpi-panel";
import { FunnelWidget } from "@/components/funnel-widget";
import { KpiCard, type SparkPoint } from "@/components/kpi-card";
import { QuickAddOrder } from "@/components/quick-add-order";
import { RangePicker } from "@/components/range-picker";
import { RefreshButton } from "@/components/refresh-button";
import { requireUser } from "@/lib/auth-helpers";
import { getClientForUser } from "@/lib/clients";
import { parseRangeFromSearchParams, delta } from "@/lib/date-range";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoas,
} from "@/lib/format";
import { assembleClientInsights } from "@/lib/insights-assembly";
import { classifyObjective, getCampaignStatusMap } from "@/lib/meta";

export default async function ClientOverviewPage({
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
  const isManager = user.role === "MANAGER";

  if (client.adAccounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect a Meta ad account</CardTitle>
          <CardDescription>
            {isManager
              ? "Paste a long-lived System User access token to start syncing campaigns."
              : "No Meta ad account is connected yet. Ask your manager to set this up."}
          </CardDescription>
        </CardHeader>
        {isManager ? (
          <CardContent>
            <Button
              nativeButton={false}
              render={<Link href={`/clients/${slug}/settings`} />}
            >
              Open settings
            </Button>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  const { range, preset } = parseRangeFromSearchParams({
    preset: typeof sp.preset === "string" ? sp.preset : undefined,
    from: typeof sp.from === "string" ? sp.from : undefined,
    to: typeof sp.to === "string" ? sp.to : undefined,
  });

  const [insights, statusMap] = await Promise.all([
    assembleClientInsights({ clientId: client.id, range }),
    getCampaignStatusMap(client.id),
  ]);

  const currency = client.adAccounts[0]?.currency ?? "EUR";
  const sparkSlice = insights.daily.slice(-14);
  const spark = (key: "spend" | "revenue" | "purchases"): SparkPoint[] =>
    sparkSlice.map((d) => ({ date: d.date, value: d[key] }));

  const k = insights.combined;
  const p = insights.combinedPrior;

  const cards = [
    {
      label: "Spend",
      value: formatCurrency(k.spend, currency),
      delta: delta(k.spend, p.spend),
      spark: spark("spend"),
    },
    {
      label: "Impressions",
      value: formatNumber(k.impressions),
      delta: delta(k.impressions, p.impressions),
    },
    {
      label: "Reach",
      value: formatNumber(k.reach),
      delta: delta(k.reach, p.reach),
      hint: k.frequency != null ? `Frequency ${k.frequency.toFixed(2)}×` : undefined,
    },
    {
      label: "Leads",
      value: formatNumber(k.leads),
      delta: delta(k.leads, p.leads),
      hint:
        k.costPerLead != null
          ? `Cost / lead ${formatCurrency(k.costPerLead, currency)}`
          : undefined,
    },
    {
      label: "Purchases (real)",
      value: formatNumber(k.purchasesReal),
      delta: delta(k.purchasesReal, p.purchasesPixel),
      spark: spark("purchases"),
      hint:
        k.cpaReal != null
          ? `CPA ${formatCurrency(k.cpaReal, currency)}${
              k.purchasesReal !== k.purchasesPixel
                ? ` · Pixel ${formatNumber(k.purchasesPixel)} + Backend ${formatNumber(
                    k.purchasesReal - k.purchasesPixel,
                  )}`
                : ""
            }`
          : undefined,
    },
    {
      label: "Revenue (real)",
      value: formatCurrency(k.revenueReal, currency),
      delta: delta(k.revenueReal, p.revenuePixel),
      spark: spark("revenue"),
    },
    {
      label: "ROAS (real)",
      value: formatRoas(k.roasReal),
      delta: delta(k.roasReal, p.roasPixel),
      hint:
        k.roasReal !== k.roasPixel
          ? `Pixel ROAS ${formatRoas(k.roasPixel)}`
          : undefined,
    },
    {
      label: "CTR (link)",
      value: formatPercent(k.ctrLink, 2),
      delta: delta(k.ctrLink, p.ctrLink),
    },
  ];

  const campaignRows = insights.byCampaign.map((c) => {
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

  const funnelStages = [
    { label: "Impressions", value: k.impressions },
    { label: "Link clicks", value: k.linkClicks },
    { label: "Landing page views", value: k.landingPageViews },
    { label: "Add to cart", value: k.addToCart },
    { label: "Initiate checkout", value: k.initiateCheckout },
    { label: "Purchases (pixel)", value: k.purchasesPixel },
    { label: "Purchases (real)", value: k.purchasesReal },
  ];

  const noData = k.spend === 0 && k.impressions === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <RangePicker preset={preset} from={range.since} to={range.until} />
        <div className="flex items-center gap-2">
          <QuickAddOrder slug={slug} clientId={client.id} currency={currency} />
          <RefreshButton slug={slug} preset={preset} />
          <Button
            nativeButton={false}
            render={
              <Link
                href={`/clients/${slug}/report?preset=${preset}&from=${range.since}&to=${range.until}`}
              />
            }
          >
            <FileText className="size-4" />
            Generate report
          </Button>
        </div>
      </div>

      {insights.error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Sync error</AlertTitle>
          <AlertDescription>{insights.error}</AlertDescription>
        </Alert>
      ) : null}

      {insights.takenAt ? (
        <p className="text-muted-foreground text-xs">
          Last synced{" "}
          {formatDistanceToNow(insights.takenAt, { addSuffix: true })}
          {insights.fromCache ? " · cached" : " · fresh"}
          {insights.google ? " · Google Ads totals included" : ""}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <KpiCard
            key={c.label}
            label={c.label}
            value={c.value}
            delta={c.delta}
            spark={c.spark}
            hint={c.hint}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Funnel</CardTitle>
            <CardDescription>
              {format(new Date(range.since), "MMM d")} →{" "}
              {format(new Date(range.until), "MMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FunnelWidget stages={funnelStages} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Campaigns (Meta)</CardTitle>
            <CardDescription>
              Sortable. Click headers to reorder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CampaignsTable rows={campaignRows} currency={currency} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChannelKpiPanel
          channel="META"
          current={insights.meta.current}
          prior={insights.meta.prior}
          currency={currency}
        />
        {insights.google ? (
          <ChannelKpiPanel
            channel="GOOGLE"
            current={insights.google.current}
            prior={insights.google.prior}
            currency={currency}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Google Ads</CardTitle>
              <CardDescription>
                {isManager
                  ? "No Google Ads totals entered for this period yet."
                  : "Google Ads data not available."}
              </CardDescription>
            </CardHeader>
            {isManager ? (
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/clients/${slug}/settings#google`} />}
                >
                  Add Google Ads totals
                </Button>
              </CardContent>
            ) : null}
          </Card>
        )}
      </div>

      {noData ? (
        <p className="text-muted-foreground text-center text-sm">
          No insights for this range yet. Click <strong>Refresh</strong> to pull
          from Meta.
        </p>
      ) : null}
    </div>
  );
}
