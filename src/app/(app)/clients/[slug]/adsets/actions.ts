"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth-helpers";
import { assertClientAccess } from "@/lib/clients";
import { isAdmin } from "@/lib/permissions";
import { decryptToken } from "@/lib/crypto";
import { setAdSetStatus, MetaApiError } from "@/lib/meta";
import { safeAuditLog } from "@/lib/audit";

const schema = z.object({
  clientId: z.string().min(1),
  slug: z.string().min(1),
  adSetId: z.string().regex(/^\d+$/u),
  status: z.enum(["ACTIVE", "PAUSED"]),
});

export type AdSetStatusState = {
  ok?: boolean;
  error?: string;
};

export async function setAdSetStatusAction(
  _prev: AdSetStatusState | undefined,
  formData: FormData,
): Promise<AdSetStatusState> {
  const user = await requireManager();
  if (!isAdmin(user)) {
    return { error: "Pausing ad sets is restricted to Admin role." };
  }
  const parsed = schema.safeParse({
    clientId: formData.get("clientId"),
    slug: formData.get("slug"),
    adSetId: formData.get("adSetId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Invalid input" };
  assertClientAccess(user, parsed.data.clientId);

  const accounts = await prisma.adAccount.findMany({
    where: { clientId: parsed.data.clientId, channel: "META" },
    select: { id: true, accessTokenEnc: true },
  });
  if (accounts.length === 0) return { error: "No Meta ad account connected." };

  let lastErr: unknown = null;
  for (const account of accounts) {
    try {
      const token = decryptToken(account.accessTokenEnc);
      await setAdSetStatus({
        adSetId: parsed.data.adSetId,
        accessToken: token,
        status: parsed.data.status,
        bucketKey: `${account.id}:adset-edit`,
      });
      await safeAuditLog({
        userId: user.id,
        action: "adset.setStatus",
        meta: {
          clientId: parsed.data.clientId,
          adSetId: parsed.data.adSetId,
          status: parsed.data.status,
          adAccountId: account.id,
        },
      });
      revalidatePath(`/clients/${parsed.data.slug}/adsets`);
      return { ok: true };
    } catch (err) {
      lastErr = err;
      if (err instanceof MetaApiError) {
        if (err.code === 100) continue; // wrong owner, try next account
        return { error: `Meta rejected: ${err.message}` };
      }
    }
  }
  return {
    error:
      lastErr instanceof Error
        ? lastErr.message
        : "Could not update ad set status",
  };
}
