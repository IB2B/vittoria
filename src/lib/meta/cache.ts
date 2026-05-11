import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";

import { fetchInsights, fetchAccountReach } from "./insights";
import type { DateRange, InsightLevel } from "./insights";
import type { MetaInsightRow } from "./types";

export type CachedInsightsResult = {
  rows: MetaInsightRow[];
  reach: number;
  takenAt: Date;
  fromCache: boolean;
};

const FRESH_MS = 1000 * 60 * 60 * 4; // §7: cron refresh every 4h

export type GetInsightsOptions = {
  adAccountId: string;
  range: DateRange;
  level?: InsightLevel;
  forceRefresh?: boolean;
};

// Returns insights for a given (adAccount, range), reading from a recent
// SyncSnapshot if one exists and re-fetching against Meta otherwise.
export async function getInsights({
  adAccountId,
  range,
  level = "campaign",
  forceRefresh = false,
}: GetInsightsOptions): Promise<CachedInsightsResult> {
  const account = await prisma.adAccount.findUnique({
    where: { id: adAccountId },
  });
  if (!account) throw new Error("Ad account not found");

  const rangeStart = new Date(range.since + "T00:00:00Z");
  const rangeEnd = new Date(range.until + "T23:59:59Z");

  if (!forceRefresh) {
    const fresh = await prisma.syncSnapshot.findFirst({
      where: {
        adAccountId,
        rangeStart,
        rangeEnd,
        takenAt: { gte: new Date(Date.now() - FRESH_MS) },
      },
      orderBy: { takenAt: "desc" },
    });
    if (fresh) {
      const payload = fresh.payload as { rows: MetaInsightRow[]; reach: number };
      return {
        rows: payload.rows,
        reach: payload.reach,
        takenAt: fresh.takenAt,
        fromCache: true,
      };
    }
  }

  const accessToken = decryptToken(account.accessTokenEnc);
  const bucketKey = `${account.id}:${accessToken.slice(0, 8)}`;

  const [rows, reach] = await Promise.all([
    fetchInsights({
      metaAccountId: account.metaAccountId,
      accessToken,
      range,
      level,
      bucketKey,
    }),
    fetchAccountReach({
      metaAccountId: account.metaAccountId,
      accessToken,
      range,
      bucketKey,
    }),
  ]);

  const snapshot = await prisma.syncSnapshot.create({
    data: {
      adAccountId,
      rangeStart,
      rangeEnd,
      payload: { rows, reach } as object,
    },
  });
  await prisma.adAccount.update({
    where: { id: adAccountId },
    data: { lastSyncedAt: snapshot.takenAt, lastSyncError: null },
  });

  return { rows, reach, takenAt: snapshot.takenAt, fromCache: false };
}
