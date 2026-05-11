import type { Channel } from "@prisma/client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoas,
} from "@/lib/format";
import { delta } from "@/lib/date-range";
import type { KpiSummary } from "@/lib/meta";
import { cn } from "@/lib/utils";

const CHANNEL_META = {
  META: {
    label: "Meta Ads",
    accent: "var(--meta)",
    initial: "M",
  },
  GOOGLE: {
    label: "Google Ads",
    accent: "var(--google)",
    initial: "G",
  },
} as const;

function deltaTone(value: number | null) {
  if (value == null) return "text-muted-foreground";
  return value >= 0 ? "text-emerald-600" : "text-rose-600";
}

function deltaText(value: number | null) {
  if (value == null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function ChannelKpiPanel({
  channel,
  current,
  prior,
  currency,
}: {
  channel: Channel;
  current: KpiSummary;
  prior: KpiSummary;
  currency: string;
}) {
  const meta = CHANNEL_META[channel];

  const stats: Array<{
    label: string;
    value: string;
    delta: number | null;
  }> = [
    {
      label: "Spend",
      value: formatCurrency(current.spend, currency),
      delta: delta(current.spend, prior.spend),
    },
    {
      label: "Leads",
      value: formatNumber(current.leads),
      delta: delta(current.leads, prior.leads),
    },
    {
      label: channel === "META" ? "Purchases (real)" : "Conversions",
      value: formatNumber(current.purchasesReal),
      delta: delta(current.purchasesReal, prior.purchasesReal),
    },
    {
      label: "ROAS",
      value: formatRoas(current.roasReal),
      delta: delta(current.roasReal, prior.roasReal),
    },
  ];

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            className="flex size-7 items-center justify-center rounded-md text-sm font-semibold text-white"
            style={{ background: meta.accent }}
          >
            {meta.initial}
          </span>
          <div>
            <CardTitle className="text-base">{meta.label}</CardTitle>
            <CardDescription>
              {formatNumber(current.impressions)} impressions ·{" "}
              {formatPercent(current.ctrLink, 2)} CTR
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="space-y-1">
              <div className="text-muted-foreground text-xs">{s.label}</div>
              <div className="font-mono text-lg tabular-nums">{s.value}</div>
              <div className={cn("text-xs", deltaTone(s.delta))}>
                {deltaText(s.delta)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
