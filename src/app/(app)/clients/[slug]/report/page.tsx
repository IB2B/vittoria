import { format } from "date-fns";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChannelKpiPanel } from "@/components/channel-kpi-panel";
import { requireUser } from "@/lib/auth-helpers";
import { getClientForUser } from "@/lib/clients";
import { parseRangeFromSearchParams } from "@/lib/date-range";
import { assembleClientInsights } from "@/lib/insights-assembly";

import { ReportBuilder } from "./report-builder";

export default async function ReportPage({
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

  const { range, preset } = parseRangeFromSearchParams({
    preset: typeof sp.preset === "string" ? sp.preset : undefined,
    from: typeof sp.from === "string" ? sp.from : undefined,
    to: typeof sp.to === "string" ? sp.to : undefined,
  });

  const insights = await assembleClientInsights({
    clientId: client.id,
    range,
  });

  const currency = client.adAccounts[0]?.currency ?? "EUR";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <ReportBuilder
          clientId={client.id}
          slug={slug}
          rangeStart={range.since}
          rangeEnd={range.until}
          preset={preset}
        />
      </div>
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>
              Live mirror of what the .docx will contain.{" "}
              {format(new Date(range.since), "MMM d")} →{" "}
              {format(new Date(range.until), "MMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
              <p className="text-muted-foreground text-sm">
                No Google Ads totals for this period — Section 3 will be
                skipped.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
