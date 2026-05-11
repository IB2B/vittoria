import { formatNumber, formatPercent } from "@/lib/format";

type Stage = {
  label: string;
  value: number;
};

export function FunnelWidget({ stages }: { stages: Stage[] }) {
  if (stages.length === 0) return null;
  const top = stages[0]?.value ?? 0;

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const ratioFromTop = top > 0 ? stage.value / top : 0;
        const widthPct = Math.max(8, ratioFromTop * 100);
        const prev = i === 0 ? null : stages[i - 1].value;
        const stepRatio = prev && prev > 0 ? stage.value / prev : null;

        return (
          <div key={stage.label} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">{stage.label}</span>
              <span className="font-mono tabular-nums">
                {formatNumber(stage.value)}
                {stepRatio != null && i > 0 ? (
                  <span className="text-muted-foreground ml-2 text-xs">
                    {formatPercent(stepRatio, 1)}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="bg-brand h-full"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
