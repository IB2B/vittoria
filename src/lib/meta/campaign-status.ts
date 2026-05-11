import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";

import { listCampaigns } from "./campaigns";

export type CampaignMeta = {
  status: string;
  effectiveStatus: string;
  objective?: string;
};

const ACTIVE_EFFECTIVE_STATUSES = new Set([
  "ACTIVE",
  "IN_PROCESS",
  "WITH_ISSUES",
]);

export function isActiveEffectiveStatus(s: string): boolean {
  return ACTIVE_EFFECTIVE_STATUSES.has(s);
}

// Fetch effective_status per campaign across every META ad account on a Client.
// Used to filter out paused/archived campaigns from the campaigns table.
export async function getCampaignStatusMap(
  clientId: string,
): Promise<Map<string, CampaignMeta>> {
  const accounts = await prisma.adAccount.findMany({
    where: { clientId, channel: "META" },
    select: { id: true, metaAccountId: true, accessTokenEnc: true },
  });

  const map = new Map<string, CampaignMeta>();
  for (const account of accounts) {
    try {
      const token = decryptToken(account.accessTokenEnc);
      const list = await listCampaigns({
        metaAccountId: account.metaAccountId,
        accessToken: token,
        bucketKey: `${account.id}:status`,
      });
      for (const c of list) {
        map.set(c.id, {
          status: c.status,
          effectiveStatus: c.effective_status,
          objective: c.objective,
        });
      }
    } catch {
      // Don't blow up the campaigns page if one account's metadata fails;
      // unknown-status rows fall through to "all" filter.
    }
  }
  return map;
}
