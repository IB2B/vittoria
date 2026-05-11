"use client";

import { Sparkles, TrendingUp, AlertTriangle } from "lucide-react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/magic/number-ticker";
import { ShinyText } from "@/components/magic/shiny-text";

export function GreetingHero({
  name,
  bmName,
  totalSpendValue,
  totalSpendCurrency,
  spendDeltaPct,
  activeClients,
  totalClients,
  hasErrors,
}: {
  name: string;
  bmName: string | null;
  totalSpendValue: number;
  totalSpendCurrency: string;
  spendDeltaPct: number | null;
  activeClients: number;
  totalClients: number;
  hasErrors: boolean;
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <Card className="glass border-magic relative overflow-hidden">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-20 size-96 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 60%, transparent), transparent)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-20 size-96 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 50%, transparent), transparent)",
        }}
      />
      <CardContent className="relative grid gap-6 p-8 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <div className="text-muted-foreground inline-flex items-center gap-1.5 text-xs uppercase tracking-wider">
            <Sparkles className="text-meta size-3" />
            <ShinyText>Live workspace</ShinyText>
            {bmName ? (
              <>
                <span>·</span>
                <span>{bmName}</span>
              </>
            ) : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {greeting}, {name.split(/\s+/)[0]}.
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm">
            {hasErrors
              ? "Some accounts didn't sync — check the heads-up panel below."
              : `Tracking ${activeClients} active client${activeClients === 1 ? "" : "s"} of ${totalClients} total. Pick a client to drill in, or ask Vittoria for the bird's-eye read.`}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {hasErrors ? (
              <Badge variant="destructive">
                <AlertTriangle className="size-3" />
                Sync errors
              </Badge>
            ) : (
              <Badge variant="outline">
                <TrendingUp className="size-3" />
                All clients in sync
              </Badge>
            )}
            <Badge variant="outline">
              {activeClients} / {totalClients} active
            </Badge>
          </div>
        </div>
        <div className="border-border/60 flex flex-col justify-center gap-1 border-l pl-6 sm:items-end">
          <div className="text-muted-foreground text-[11px] uppercase tracking-wider">
            Total spend (window)
          </div>
          <div className="hero-number font-mono text-4xl font-semibold tabular-nums">
            <NumberTicker
              value={totalSpendValue}
              durationMs={1400}
              format={(n) =>
                new Intl.NumberFormat("it-IT", {
                  style: "currency",
                  currency: totalSpendCurrency,
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(n)
              }
            />
          </div>
          {spendDeltaPct != null ? (
            <div
              className={
                spendDeltaPct >= 0
                  ? "text-emerald-600 text-xs"
                  : "text-rose-600 text-xs"
              }
            >
              {spendDeltaPct >= 0 ? "+" : ""}
              {(spendDeltaPct * 100).toFixed(1)}% vs prior period
            </div>
          ) : (
            <div className="text-muted-foreground text-xs">vs prior —</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
