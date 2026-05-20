import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";

import { metaGetAllPages } from "./client";

export type MetaAdSet = {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  effective_status: string;
  campaign_id: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

export async function listAdSets({
  metaAccountId,
  accessToken,
  bucketKey,
}: {
  metaAccountId: string;
  accessToken: string;
  bucketKey?: string;
}): Promise<MetaAdSet[]> {
  return metaGetAllPages<MetaAdSet>(
    `${metaAccountId}/adsets`,
    {
      fields: [
        "id",
        "name",
        "status",
        "effective_status",
        "campaign_id",
        "daily_budget",
        "lifetime_budget",
      ],
      limit: 200,
    },
    { accessToken, bucketKey },
  );
}

export type AdSetMeta = {
  status: string;
  effectiveStatus: string;
  campaignId: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
};

// Aggregate ad-set metadata across every META ad account on a Client. Used by
// the ad sets page to render status + budget alongside cached insights.
export async function getAdSetStatusMap(
  clientId: string,
): Promise<Map<string, AdSetMeta>> {
  const accounts = await prisma.adAccount.findMany({
    where: { clientId, channel: "META" },
    select: { id: true, metaAccountId: true, accessTokenEnc: true },
  });
  const map = new Map<string, AdSetMeta>();
  for (const account of accounts) {
    try {
      const token = decryptToken(account.accessTokenEnc);
      const list = await listAdSets({
        metaAccountId: account.metaAccountId,
        accessToken: token,
        bucketKey: `${account.id}:adsets`,
      });
      for (const a of list) {
        map.set(a.id, {
          status: a.status,
          effectiveStatus: a.effective_status,
          campaignId: a.campaign_id,
          dailyBudget: a.daily_budget
            ? Number(a.daily_budget) / 100 // Meta returns cents
            : undefined,
          lifetimeBudget: a.lifetime_budget
            ? Number(a.lifetime_budget) / 100
            : undefined,
        });
      }
    } catch {
      // Skip silently — single-account failures shouldn't break the page.
    }
  }
  return map;
}
