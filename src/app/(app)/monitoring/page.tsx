import { AlertOctagon, Activity, Bell } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth-helpers";
import { getActiveBm, whereClientInBm } from "@/lib/business-managers";

import { AlertCard } from "./alert-card";
import { RunNowButton } from "./run-now-button";

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;

export default async function MonitoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const sp = await searchParams;
  const filter =
    typeof sp.status === "string" && sp.status === "all" ? "all" : "open";
  const activeBm = await getActiveBm();
  const bmFilter = whereClientInBm(activeBm);

  const alerts = await prisma.monitoringAlert.findMany({
    where: {
      ...(filter === "open" ? { status: "OPEN" } : {}),
      client:
        Object.keys(bmFilter).length === 0
          ? undefined
          : (bmFilter as Record<string, unknown>),
    },
    include: {
      client: { select: { name: true, slug: true } },
    },
    orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
    take: 200,
  });

  // Bucket by severity for the summary cards + headers.
  const bySeverity: Record<string, typeof alerts> = {
    CRITICAL: [],
    HIGH: [],
    MEDIUM: [],
    LOW: [],
    INFO: [],
  };
  for (const a of alerts) {
    bySeverity[a.severity].push(a);
  }

  const openCount = alerts.filter((a) => a.status === "OPEN").length;
  const criticalCount = bySeverity.CRITICAL.length;
  const highCount = bySeverity.HIGH.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring"
        description="Nightly sweep across every client. Vittoria flags anomalies, suggests fixes, and ranks them by severity. Mark items resolved as you fix them."
        actions={<RunNowButton />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Open alerts"
          value={openCount}
          icon={Bell}
          tint="59 130 246"
        />
        <SummaryCard
          label="Critical"
          value={criticalCount}
          icon={AlertOctagon}
          tint="239 68 68"
        />
        <SummaryCard
          label="High priority"
          value={highCount}
          icon={Activity}
          tint="245 158 11"
        />
      </div>

      {alerts.length === 0 ? (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">No alerts right now</CardTitle>
            <CardDescription>
              The nightly sweep runs at 23:59 UTC. You can also trigger it
              manually with the button above. If everything looks healthy
              across your portfolio, this is what you want to see.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          {SEVERITY_ORDER.map((sev) => {
            const list = bySeverity[sev];
            if (list.length === 0) return null;
            return (
              <section key={sev} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-medium uppercase tracking-wider">
                    {sev.toLowerCase()}
                  </h2>
                  <Badge variant="outline">{list.length}</Badge>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {list.map((a) => (
                    <AlertCard
                      key={a.id}
                      alert={{
                        id: a.id,
                        clientId: a.clientId,
                        clientName: a.client.name,
                        clientSlug: a.client.slug,
                        category: a.category,
                        campaignName: a.campaignName,
                        title: a.title,
                        description: a.description,
                        suggestion: a.suggestion,
                        severity: a.severity,
                        status: a.status,
                        metrics:
                          (a.metrics as Record<string, unknown>) ?? {},
                        detectedAt: a.detectedAt.toISOString(),
                        resolvedAt: a.resolvedAt?.toISOString() ?? null,
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tint: string;
}) {
  return (
    <Card className="glass relative overflow-hidden">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-10 size-32 rounded-full opacity-25 blur-2xl"
        style={{ background: `rgb(${tint} / 0.4)` }}
      />
      <CardHeader className="pb-2">
        <CardDescription className="text-[10px] uppercase tracking-wider">
          {label}
        </CardDescription>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="hero-number font-mono text-3xl font-semibold tabular-nums">
            {value}
          </CardTitle>
          <span
            className="flex size-9 items-center justify-center rounded-md"
            style={{ background: `rgb(${tint} / 0.15)`, color: `rgb(${tint})` }}
          >
            <Icon className="size-4" />
          </span>
        </div>
      </CardHeader>
      <CardContent className="pb-3" />
    </Card>
  );
}
