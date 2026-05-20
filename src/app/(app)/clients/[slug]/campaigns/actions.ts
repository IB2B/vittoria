"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth-helpers";
import { assertClientAccess } from "@/lib/clients";
import { isAdmin } from "@/lib/permissions";
import { decryptToken } from "@/lib/crypto";
import { setCampaignStatus, MetaApiError } from "@/lib/meta";
import { safeAuditLog } from "@/lib/audit";

const schema = z.object({
  clientId: z.string().min(1),
  slug: z.string().min(1),
  campaignId: z.string().regex(/^\d+$/u),
  status: z.enum(["ACTIVE", "PAUSED"]),
});

export type CampaignStatusState = {
  ok?: boolean;
  error?: string;
};

// Toggle campaign status from the campaigns table. ADMIN role only because
// it's a destructive write against Meta. Tries each connected ad account for
// the client until one accepts the campaign id — we don't track campaign →
// adAccount mapping in our DB.
export async function setCampaignStatusAction(
  _prev: CampaignStatusState | undefined,
  formData: FormData,
): Promise<CampaignStatusState> {
  const user = await requireManager();
  if (!isAdmin(user)) {
    return { error: "Pausing campaigns is restricted to Admin role." };
  }

  const parsed = schema.safeParse({
    clientId: formData.get("clientId"),
    slug: formData.get("slug"),
    campaignId: formData.get("campaignId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Invalid input" };
  assertClientAccess(user, parsed.data.clientId);

  const accounts = await prisma.adAccount.findMany({
    where: { clientId: parsed.data.clientId, channel: "META" },
    select: { id: true, accessTokenEnc: true },
  });
  if (accounts.length === 0) {
    return { error: "No Meta ad account connected." };
  }

  let lastErr: unknown = null;
  for (const account of accounts) {
    try {
      const token = decryptToken(account.accessTokenEnc);
      await setCampaignStatus({
        campaignId: parsed.data.campaignId,
        accessToken: token,
        status: parsed.data.status,
        bucketKey: `${account.id}:edit`,
      });
      await safeAuditLog({
        userId: user.id,
        action: "campaign.setStatus",
        meta: {
          clientId: parsed.data.clientId,
          campaignId: parsed.data.campaignId,
          status: parsed.data.status,
          adAccountId: account.id,
        },
      });
      revalidatePath(`/clients/${parsed.data.slug}`, "layout");
      return { ok: true };
    } catch (err) {
      lastErr = err;
      if (err instanceof MetaApiError) {
        // Code 100 = campaign doesn't belong to this ad account — try the next.
        if (err.code === 100) continue;
        return { error: `Meta rejected: ${err.message}` };
      }
    }
  }
  return {
    error:
      lastErr instanceof Error
        ? lastErr.message
        : "Could not update campaign status",
  };
}
