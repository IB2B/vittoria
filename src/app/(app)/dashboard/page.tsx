import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { RangePicker } from "@/components/range-picker";
import { SpendRevenueChart } from "@/components/spend-revenue-chart";
import { requireUser } from "@/lib/auth-helpers";
import { parseRangeFromSearchParams, delta } from "@/lib/date-range";
import {
  formatCurrency,
  formatNumber,
  formatRoas,
} from "@/lib/format";
import { loadDashboardRollup } from "@/lib/dashboard-rollup";
import { previousRange } from "@/lib/date-range";
import { prisma } from "@/lib/db";
import { getActiveBm } from "@/lib/business-managers";

import { ClientsRollupTable } from "./clients-rollup-table";
import { TopClientsCard, TopCampaignsCard } from "./leaderboards";
import { GreetingHero } from "./greeting-hero";
import { listBusinessManagers, ALL_BMS } from "@/lib/business-managers";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();

  // Only the CLIENT role gets the no-client redirect — ADMIN, MANAGER, and
  // VIEWER all see the agency-wide rollup. Earlier this check excluded ADMIN
  // by accident, which is why fresh admins landed on "No client linked yet".
  if (user.role === "CLIENT") {
    if (user.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: user.clientId },
        select: { slug: true },
      });
      if (client) redirect(`/clients/${client.slug}`);
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>No client linked yet</CardTitle>
          <CardDescription>
            Your account is not associated with a client. Ask your account
            manager.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const sp = await searchParams;
  const { range, preset } = parseRangeFromSearchParams({
    preset: typeof sp.preset === "string" ? sp.preset : undefined,
    from: typeof sp.from === "string" ? sp.from : undefined,
    to: typeof sp.to === "string" ? sp.to : undefined,
  });
  const previous = previousRange(range);

  const activeBm = await getActiveBm();
  const [current, prior, bms] = await Promise.all([
    loadDashboardRollup(range, activeBm),
    loadDashboardRollup(previous, activeBm),
    listBusinessManagers(),
  ]);
  const activeBmName =
    activeBm === ALL_BMS
      ? null
      : (bms.find((b) => b.id === activeBm)?.name ?? null);

  const t = current.totals;
  const p = prior.totals;
  const cards = [
    {
      label: "Total spend",
      value: formatCurrency(t.spend, "EUR"),
      delta: delta(t.spend, p.spend),
    },
    {
      label: "Leads",
      value: formatNumber(t.leads),
      delta: delta(t.leads, p.leads),
      hint:
        t.costPerLead != null
          ? `Cost / lead ${formatCurrency(t.costPerLead, "EUR")}`
          : undefined,
    },
    {
      label: "Purchases",
      value: formatNumber(t.purchases),
      delta: delta(t.purchases, p.purchases),
      hint:
        t.cpa != null ? `CPA ${formatCurrency(t.cpa, "EUR")}` : undefined,
    },
    {
      label: "Revenue",
      value: formatCurrency(t.revenue, "EUR"),
      delta: delta(t.revenue, p.revenue),
    },
    {
      label: "Blended ROAS",
      value: formatRoas(t.roas),
      delta: delta(t.roas, p.roas),
    },
  ];

  const activeClients = current.clients.filter((c) => c.spend > 0).length;
  const hasErrors = current.clients.some((c) => c.hasError);

  return (
    <div className="space-y-6">
      <GreetingHero
        name={user.name ?? user.email.split("@")[0]}
        bmName={activeBmName}
        totalSpendValue={t.spend}
        totalSpendCurrency="EUR"
        spendDeltaPct={cards[0].delta}
        activeClients={activeClients}
        totalClients={current.clients.length}
        hasErrors={hasErrors}
      />

      <div className="flex items-center justify-end">
        <RangePicker preset={preset} from={range.since} to={range.until} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="glass relative overflow-hidden">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-12 -right-10 size-32 rounded-full opacity-30 blur-2xl"
              style={{
                background:
                  "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 50%, transparent), transparent)",
              }}
            />
            <CardHeader className="pb-2">
              <CardDescription>{c.label}</CardDescription>
              <CardTitle className="font-mono text-2xl tabular-nums">
                {c.value}
              </CardTitle>
            </CardHeader>
            <CardContent
              className={
                c.delta == null
                  ? "text-muted-foreground text-xs"
                  : c.delta >= 0
                    ? "text-emerald-600 text-xs"
                    : "text-rose-600 text-xs"
              }
            >
              {c.delta == null
                ? "vs previous period —"
                : `${c.delta >= 0 ? "+" : ""}${(c.delta * 100).toFixed(1)}% vs previous period`}
              {c.hint ? (
                <div className="text-muted-foreground mt-0.5 font-normal">
                  {c.hint}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <SpendRevenueChart data={current.daily} />

      <div className="grid gap-6 lg:grid-cols-3">
        <TopClientsCard rows={current.clients} />
        <TopCampaignsCard
          title="Top campaigns by spend"
          description="Where the budget is going across all clients."
          rows={current.topCampaignsBySpend}
          metric="spend"
        />
        <TopCampaignsCard
          title="Best ROAS"
          description="Highest return on ad spend (sales campaigns)."
          rows={current.topCampaignsByRoas}
          metric="roas"
        />
      </div>

      {current.topCampaignsByLeads.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <TopCampaignsCard
            title="Top lead generators"
            description="Lead-gen campaigns ranked by volume."
            rows={current.topCampaignsByLeads}
            metric="leads"
          />
          <Card className="glass lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Heads up</CardTitle>
              <CardDescription>
                Things worth a glance before opening a client.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <HealthLines clients={current.clients} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Heads up</CardTitle>
            <CardDescription>
              Things worth a glance before opening a client.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <HealthLines clients={current.clients} />
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">All clients</CardTitle>
          <CardDescription>
            Sorted by spend. Click a row to drill in, or generate a report
            inline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientsRollupTable
            rows={current.clients}
            preset={preset}
            from={range.since}
            to={range.until}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Surfaces things the user actually needs to act on: clients with no data,
// stale syncs, or sync errors. Keep terse — bullet form, no fluff.
function HealthLines({
  clients,
}: {
  clients: Array<{
    name: string;
    slug: string;
    spend: number;
    lastSyncedAt: string | null;
    hasError: boolean;
  }>;
}) {
  const errored = clients.filter((c) => c.hasError);
  const noData = clients.filter((c) => c.spend === 0 && !c.hasError);
  const noSync = clients.filter((c) => !c.lastSyncedAt && !c.hasError);

  const lines: string[] = [];
  if (errored.length > 0) {
    lines.push(
      `${errored.length} client${errored.length === 1 ? " has" : "s have"} a sync error: ${errored
        .slice(0, 3)
        .map((c) => c.name)
        .join(", ")}${errored.length > 3 ? "…" : ""}`,
    );
  }
  if (noSync.length > 0) {
    lines.push(
      `${noSync.length} client${noSync.length === 1 ? " hasn't" : "s haven't"} synced yet — open them once to backfill.`,
    );
  }
  if (noData.length > 0 && noData.length !== clients.length) {
    lines.push(
      `${noData.length} client${noData.length === 1 ? " has" : "s have"} no spend in this window.`,
    );
  }
  if (lines.length === 0) {
    return (
      <p className="text-muted-foreground">
        Everything looks healthy across all clients.
      </p>
    );
  }
  return (
    <ul className="list-disc pl-5">
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}
