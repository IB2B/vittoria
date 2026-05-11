"use client";

import { Line, LineChart, YAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { NumberTicker } from "@/components/magic/number-ticker";
import { cn } from "@/lib/utils";

export type SparkPoint = { date: string; value: number };

// `value` is rendered as-is by default. If `numeric` + `format` are provided,
// the headline animates with the count-up effect.
export function KpiCard({
  label,
  value,
  numeric,
  format,
  delta,
  spark,
  sparkColor = "var(--brand)",
  hint,
}: {
  label: string;
  value: string;
  numeric?: number;
  format?: (n: number) => string;
  delta?: number | null;
  spark?: SparkPoint[];
  sparkColor?: string;
  hint?: string;
}) {
  const hasDelta = delta != null;
  const positive = (delta ?? 0) >= 0;

  return (
    <Card className="glass group/kpi relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-10 size-32 rounded-full opacity-30 blur-2xl transition-opacity group-hover/kpi:opacity-50"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 50%, transparent), transparent)",
        }}
      />
      <CardHeader className="pb-1">
        <CardDescription className="text-[10px] font-medium uppercase tracking-wider">
          {label}
        </CardDescription>
        <div className="hero-number font-mono text-3xl font-semibold leading-tight tabular-nums">
          {numeric != null && format ? (
            <NumberTicker value={numeric} format={format} durationMs={1000} />
          ) : (
            value
          )}
        </div>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3 pb-3">
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            !hasDelta && "text-muted-foreground",
            hasDelta && positive && "text-emerald-600",
            hasDelta && !positive && "text-rose-600",
          )}
        >
          {hasDelta ? (
            <>
              {positive ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {`${positive ? "+" : ""}${(delta! * 100).toFixed(1)}%`}
            </>
          ) : (
            <span>vs prior period —</span>
          )}
        </div>
        <div className="h-8 w-24">
          {spark && spark.length > 1 ? (
            <LineChart width={96} height={32} data={spark}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={sparkColor}
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          ) : null}
        </div>
      </CardContent>
      {hint ? (
        <p className="text-muted-foreground px-6 pb-3 text-xs">{hint}</p>
      ) : null}
    </Card>
  );
}
