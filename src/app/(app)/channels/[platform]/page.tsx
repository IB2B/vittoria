import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

const PLATFORMS = {
  meta: {
    label: "Meta Ads",
    color: "var(--meta)",
    pitch:
      "Channel-wide overview across all your Meta-connected clients: spend, leads, purchases, top-performing campaigns, anomalies. Currently per-client only — surface here once aggregation is wired.",
  },
  google: {
    label: "Google Ads",
    color: "var(--google)",
    pitch:
      "Native Google Ads sync — Search, Performance Max, YouTube, Demand Gen — across every client account your manager (MCC) has access to. Right now Google data is manual entry only.",
  },
  tiktok: {
    label: "TikTok Ads",
    color: "#FF0050",
    pitch:
      "TikTok Ads Manager API integration: spend, video views, leads, purchases, creator-handover analytics. Not started yet.",
  },
} as const;

type Platform = keyof typeof PLATFORMS;

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  if (!(platform in PLATFORMS)) notFound();
  const meta = PLATFORMS[platform as Platform];

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.label}
        description="Channel-wide overview across every connected client."
        actions={<Badge variant="outline">Coming soon</Badge>}
      />

      <Card className="glass relative overflow-hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full opacity-40 blur-3xl"
          style={{
            background: `radial-gradient(closest-side, color-mix(in oklab, ${meta.color} 60%, transparent), transparent)`,
          }}
        />
        <CardHeader>
          <div className="flex items-center gap-2">
            <span
              className="size-3 rounded-full"
              style={{ background: meta.color }}
            />
            <CardTitle className="text-xl">{meta.label} dashboard</CardTitle>
          </div>
          <CardDescription>{meta.pitch}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Until this ships, use the per-client overviews on{" "}
            <span className="font-medium">Clients</span> for{" "}
            {meta.label === "Meta Ads"
              ? "live Meta data"
              : meta.label === "Google Ads"
                ? "manual Google totals (Settings → Google Ads totals)"
                : "anything TikTok-related"}
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function generateStaticParams() {
  return Object.keys(PLATFORMS).map((platform) => ({ platform }));
}
