import Link from "next/link";
import { ShoppingCart, UserPlus, ArrowUpRight, Trophy } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatNumber,
  formatRoas,
} from "@/lib/format";
import type {
  ClientRollupRow,
  TopCampaignRow,
} from "@/lib/dashboard-rollup";

export function TopClientsCard({ rows }: { rows: ClientRollupRow[] }) {
  const top = rows.slice(0, 5);
  const max = top[0]?.spend ?? 0;

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trophy className="text-meta size-4" />
          <CardTitle className="text-base">Top spending clients</CardTitle>
        </div>
        <CardDescription>By total spend in the selected window.</CardDescription>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-muted-foreground text-sm">No spend yet.</p>
        ) : (
          <ol className="space-y-3">
            {top.map((c, i) => {
              const pct = max > 0 ? (c.spend / max) * 100 : 0;
              return (
                <li key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/clients/${c.slug}`}
                      className="flex min-w-0 items-center gap-2 hover:underline"
                    >
                      <span className="text-muted-foreground w-4 shrink-0 font-mono text-xs tabular-nums">
                        {i + 1}.
                      </span>
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: c.brandColor ?? "var(--brand)" }}
                        aria-hidden
                      />
                      <span className="truncate text-sm font-medium">
                        {c.name}
                      </span>
                    </Link>
                    <span className="font-mono text-xs tabular-nums shrink-0">
                      {formatCurrency(c.spend, c.currency)}
                    </span>
                  </div>
                  <div className="bg-muted/60 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background:
                          "linear-gradient(90deg, var(--brand), color-mix(in oklab, var(--brand) 50%, white))",
                      }}
                    />
                  </div>
                  <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
                    {c.leads > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <UserPlus className="size-3" />
                        {formatNumber(c.leads)} leads
                      </span>
                    ) : null}
                    {c.purchases > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <ShoppingCart className="size-3" />
                        {formatNumber(c.purchases)} purchases
                      </span>
                    ) : null}
                    {c.roas != null ? (
                      <span>ROAS {formatRoas(c.roas)}</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function TopCampaignsCard({
  title,
  description,
  rows,
  metric,
}: {
  title: string;
  description: string;
  rows: TopCampaignRow[];
  metric: "spend" | "roas" | "leads";
}) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No campaigns match this metric in the window.
          </p>
        ) : (
          <ol className="space-y-3">
            {rows.map((c, i) => (
              <li key={c.campaignId} className="flex items-start gap-3">
                <span className="text-muted-foreground w-4 shrink-0 font-mono text-xs tabular-nums">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium" title={c.campaignName}>
                      {c.campaignName}
                    </span>
                    <span className="font-mono text-xs tabular-nums shrink-0">
                      {metric === "spend"
                        ? formatCurrency(c.spend, c.currency)
                        : metric === "roas"
                          ? formatRoas(c.roas)
                          : formatNumber(c.leads)}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                    <Link
                      href={`/clients/${c.clientSlug}`}
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      {c.clientName}
                      <ArrowUpRight className="size-3" />
                    </Link>
                    <Badge variant="ghost" className="text-[10px]">
                      {c.leads > 0 && c.purchases === 0
                        ? "leads"
                        : c.purchases > 0
                          ? "sales"
                          : "—"}
                    </Badge>
                    {metric !== "spend" ? (
                      <span>· {formatCurrency(c.spend, c.currency)} spend</span>
                    ) : null}
                    {metric !== "roas" && c.roas != null && c.purchases > 0 ? (
                      <span>· ROAS {formatRoas(c.roas)}</span>
                    ) : null}
                    {metric !== "leads" && c.leads > 0 ? (
                      <span>· {formatNumber(c.leads)} leads</span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
