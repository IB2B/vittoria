import { format, subDays } from "date-fns";

import { prisma } from "@/lib/db";
import { assembleClientInsights } from "@/lib/insights-assembly";
import type { DateRange } from "@/lib/meta";

import {
  runRules,
  type Baseline,
  type RuleContext,
  type SyncErrorInfo,
} from "./rules";

const ISO = "yyyy-MM-dd";

function isProfile(
  v: string,
): v is "lead_gen" | "ecommerce" | "mixed" | "awareness" {
  return ["lead_gen", "ecommerce", "mixed", "awareness"].includes(v);
}

// Median of a number array, null when empty.
function median(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n));
  if (v.length === 0) return null;
  const sorted = [...v].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Build a 7-day rolling baseline ending the day BEFORE `referenceDate`. This
// is the "what's normal" benchmark we compare yesterday against.
async function buildBaseline(
  clientId: string,
  referenceDate: Date,
): Promise<Baseline> {
  const dailyCpls: number[] = [];
  const dailyCpas: number[] = [];
  const dailyCtrs: number[] = [];
  const dailySpends: number[] = [];
  let daysWithLeads = 0;
  let daysWithPurchases = 0;

  for (let i = 1; i <= 7; i++) {
    const day = subDays(referenceDate, i);
    const range: DateRange = {
      since: format(day, ISO),
      until: format(day, ISO),
    };
    try {
      const ins = await assembleClientInsights({ clientId, range });
      const k = ins.combined;
      if (k.costPerLead != null) dailyCpls.push(k.costPerLead);
      if (k.cpaPixel != null) dailyCpas.push(k.cpaPixel);
      if (k.ctrLink != null) dailyCtrs.push(k.ctrLink);
      dailySpends.push(k.spend);
      if (k.leads > 0) daysWithLeads += 1;
      if (k.purchasesPixel > 0) daysWithPurchases += 1;
    } catch {
      // ignore per-day failures — baseline is best-effort
    }
  }

  return {
    medianCpl: median(dailyCpls),
    medianCpa: median(dailyCpas),
    medianCtr: median(dailyCtrs),
    medianDailySpend: median(dailySpends) ?? 0,
    daysWithLeads,
    daysWithPurchases,
  };
}

export type MonitoringRunResult = {
  clientsScanned: number;
  alertsCreated: number;
  alertsRefreshed: number;
  clientsErrored: number;
};

// Runs the nightly detection across every active client. Idempotent: if an
// alert with the same `dedupKey` exists, we update it (refreshed metrics +
// detectedAt) instead of creating a duplicate.
export async function runMonitoring(): Promise<MonitoringRunResult> {
  const result: MonitoringRunResult = {
    clientsScanned: 0,
    alertsCreated: 0,
    alertsRefreshed: 0,
    clientsErrored: 0,
  };

  const clients = await prisma.client.findMany({
    where: { archived: false },
    select: {
      id: true,
      name: true,
      adAccounts: {
        where: { channel: "META" },
        select: {
          id: true,
          currency: true,
          metaAccountId: true,
          lastSyncError: true,
          lastSyncedAt: true,
        },
      },
    },
  });

  // "Yesterday" relative to whenever this runs. Cron fires at 23:59 each
  // day, so "yesterday" = today's date in local terms. We use UTC throughout.
  const today = new Date();
  const yesterday = subDays(today, 1);
  const twoDaysAgo = subDays(today, 2);

  for (const client of clients) {
    result.clientsScanned += 1;
    try {
      const currency = client.adAccounts[0]?.currency ?? "EUR";

      // Sync errors are noticed even when Meta returns no data — they're
      // surfaced as CRITICAL alerts directly, independent of insights.
      const syncErrors: SyncErrorInfo[] = client.adAccounts
        .filter((a) => a.lastSyncError)
        .map((a) => ({
          adAccountId: a.id,
          metaAccountId: a.metaAccountId,
          errorMessage: a.lastSyncError ?? "Unknown sync error",
          lastSyncedAt: a.lastSyncedAt,
        }));

      // Pull yesterday + the day before. If Meta is blocked, these may be
      // zeros — runRules handles the "went dark" + "sync error" cases below.
      const [yIns, twoIns] = await Promise.all([
        assembleClientInsights({
          clientId: client.id,
          range: {
            since: format(yesterday, ISO),
            until: format(yesterday, ISO),
          },
        }).catch(() => null),
        assembleClientInsights({
          clientId: client.id,
          range: {
            since: format(twoDaysAgo, ISO),
            until: format(twoDaysAgo, ISO),
          },
        }).catch(() => null),
      ]);

      // If we couldn't even assemble yesterday's snapshot AND we don't have
      // a sync error to explain it, skip this client (likely zero ad accounts
      // connected). Don't pollute the dashboard with noise.
      if (!yIns && syncErrors.length === 0) {
        continue;
      }

      const yCombined = yIns?.combined ?? {
        spend: 0,
        impressions: 0,
        reach: 0,
        frequency: null,
        cpm: null,
        linkClicks: 0,
        cpcLink: null,
        ctrLink: null,
        landingPageViews: 0,
        costPerLpv: null,
        addToCart: 0,
        initiateCheckout: 0,
        leads: 0,
        costPerLead: null,
        purchasesPixel: 0,
        revenuePixel: 0,
        cpaPixel: null,
        roasPixel: null,
        purchasesReal: 0,
        revenueReal: 0,
        cpaReal: null,
        roasReal: null,
      };
      const twoCombined = twoIns?.combined ?? null;

      // Determine campaign profile from yesterday's combined metrics — or
      // fall back to "awareness" if the client is dark.
      const profile =
        yCombined.leads > 0 && yCombined.purchasesReal > 0
          ? "mixed"
          : yCombined.leads > 0
            ? "lead_gen"
            : yCombined.purchasesReal > 0
              ? "ecommerce"
              : "awareness";

      const baseline = await buildBaseline(client.id, today);
      // "Had recent activity" = ≥1 day in the prior week with spend > 0.
      // Lets ruleWentDark distinguish "just paused" from "never active".
      const hadRecentActivity = baseline.medianDailySpend > 0;

      const ctx: RuleContext = {
        clientId: client.id,
        clientName: client.name,
        campaignProfile: isProfile(profile) ? profile : "awareness",
        yesterday: {
          date: format(yesterday, ISO),
          current: yCombined,
        },
        twoDaysAgo:
          twoCombined != null
            ? {
                date: format(twoDaysAgo, ISO),
                current: twoCombined,
              }
            : null,
        baseline,
        currency,
        hadRecentActivity,
        syncErrors,
      };

      const detected = runRules(ctx);

      for (const a of detected) {
        // Upsert by dedupKey. If an OPEN alert with this key already exists,
        // refresh its metrics + detectedAt so the count keeps climbing.
        // RESOLVED/DISMISSED alerts with the same key get re-opened only via
        // a per-day suffix in the dedup key, so historic resolutions aren't
        // reopened automatically.
        const existing = await prisma.monitoringAlert.findUnique({
          where: { dedupKey: a.dedupKey },
        });
        if (existing) {
          await prisma.monitoringAlert.update({
            where: { id: existing.id },
            data: {
              metrics: a.metrics as unknown as object,
              detectedAt: new Date(),
              // Don't clobber user-resolved/dismissed status. Only reopen if
              // it was OPEN and detection still fires (counts as a refresh).
            },
          });
          result.alertsRefreshed += 1;
        } else {
          await prisma.monitoringAlert.create({
            data: {
              clientId: client.id,
              campaignId: a.campaignId ?? null,
              campaignName: a.campaignName ?? null,
              category: a.category,
              title: a.title,
              description: a.description,
              suggestion: a.suggestion,
              severity: a.severity,
              metrics: a.metrics as unknown as object,
              dedupKey: a.dedupKey,
            },
          });
          result.alertsCreated += 1;
        }
      }
    } catch (err) {
      result.clientsErrored += 1;
      console.warn(
        `[monitoring] client ${client.id} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return result;
}
