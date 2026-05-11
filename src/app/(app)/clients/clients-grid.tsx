import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, ExternalLink, Activity } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/format";

export type ClientCard = {
  id: string;
  name: string;
  slug: string;
  archived: boolean;
  brandColor: string | null;
  currency: string;
  activeCampaigns: number;
  lastSyncedAt: string | null;
  thisMonthSpend: number | null;
  thisMonthImpressions: number | null;
};

export function ClientsGrid({ clients }: { clients: ClientCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clients.map((c) => {
        const accent = c.brandColor ?? "var(--brand)";
        return (
          <Card
            key={c.id}
            className="glass group relative overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span
              className="absolute inset-x-0 top-0 h-1"
              style={{ background: accent }}
              aria-hidden
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-12 size-40 rounded-full opacity-30 blur-2xl"
              style={{
                background:
                  "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 60%, transparent), transparent)",
              }}
            />
            <div className="relative flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="text-brand-foreground flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold shadow-sm"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--brand) 0%, color-mix(in oklab, var(--brand) 60%, white) 100%)",
                    }}
                  >
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/clients/${c.slug}`}
                      className="block truncate font-semibold tracking-tight hover:underline"
                    >
                      {c.name}
                    </Link>
                    <div className="text-muted-foreground truncate font-mono text-xs">
                      {c.slug}
                    </div>
                  </div>
                </div>
                {c.archived ? (
                  <Badge variant="outline" className="shrink-0">
                    archived
                  </Badge>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
                    Spend (30d)
                  </div>
                  <div className="font-mono text-base tabular-nums">
                    {c.thisMonthSpend != null
                      ? formatCurrency(c.thisMonthSpend, c.currency)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
                    Impressions
                  </div>
                  <div className="font-mono text-base tabular-nums">
                    {c.thisMonthImpressions != null
                      ? formatNumber(c.thisMonthImpressions)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
                    Active campaigns
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-base tabular-nums">
                    <Activity className="text-meta size-3.5" />
                    {formatNumber(c.activeCampaigns)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
                    Last sync
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {c.lastSyncedAt
                      ? formatDistanceToNow(new Date(c.lastSyncedAt), {
                          addSuffix: true,
                        })
                      : "never"}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <span className="text-muted-foreground text-xs">
                  {c.currency}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  nativeButton={false}
                  render={<Link href={`/clients/${c.slug}`} />}
                  className="group-hover:bg-muted"
                >
                  Open
                  <ArrowUpRight className="size-3.5" />
                </Button>
              </div>
            </div>
            <Link
              href={`/clients/${c.slug}`}
              aria-label={`Open ${c.name}`}
              className="absolute inset-0"
            >
              <span className="sr-only">Open {c.name}</span>
              <ExternalLink className="size-3.5 opacity-0" />
            </Link>
          </Card>
        );
      })}
    </div>
  );
}
