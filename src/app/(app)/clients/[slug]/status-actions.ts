"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { canMutate } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { decryptToken } from "@/lib/crypto";
import { safeAuditLog } from "@/lib/audit";
import {
  MetaApiError,
  setAdSetStatus,
  setCampaignStatus,
  type CampaignStatus,
} from "@/lib/meta";

const schema = z.object({
  slug: z.string().min(1),
  clientId: z.string().min(1),
  kind: z.enum(["campaign", "adset"]),
  nodeId: z.string().min(1),
  status: z.enum(["ACTIVE", "PAUSED"]),
});

export type StatusToggleState = {
  ok?: boolean;
  error?: string;
  newStatus?: CampaignStatus;
};

// Toggle campaign or ad-set status against Meta. Admin-only (the chat tool
// uses the same restriction). Tries each connected META ad account on the
// client until one accepts the node id — we don't track campaign→account
// mapping in our DB, so this is best-effort fan-out.
export async function toggleStatusAction(
  _prev: StatusToggleState | undefined,
  formData: FormData,
): Promise<StatusToggleState> {
  const user = await requireUser();
  if (user.role !== Role.ADMIN) {
    return { error: "Pausing/activating is restricted to Admin role." };
  }
  if (!canMutate(user)) {
    return { error: "Your role can't mutate ad delivery." };
  }
  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    clientId: formData.get("clientId"),
    kind: formData.get("kind"),
    nodeId: formData.get("nodeId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Invalid input." };

  const accounts = await prisma.adAccount.findMany({
    where: { clientId: parsed.data.clientId, channel: "META" },
    select: { id: true, accessTokenEnc: true, metaAccountId: true },
  });
  if (accounts.length === 0) {
    return { error: "No Meta ad accounts connected on this client." };
  }

  let lastErr: unknown = null;
  for (const account of accounts) {
    try {
      const token = decryptToken(account.accessTokenEnc);
      if (parsed.data.kind === "campaign") {
        await setCampaignStatus({
          campaignId: parsed.data.nodeId,
          accessToken: token,
          status: parsed.data.status,
        });
      } else {
        await setAdSetStatus({
          adSetId: parsed.data.nodeId,
          accessToken: token,
          status: parsed.data.status,
        });
      }
      await safeAuditLog({
        userId: user.id,
        action: `${parsed.data.kind}.setStatus`,
        meta: {
          clientId: parsed.data.clientId,
          slug: parsed.data.slug,
          nodeId: parsed.data.nodeId,
          status: parsed.data.status,
          adAccountId: account.id,
        },
      });
      // Path revalidation — the campaigns table and ad sets page both read
      // status from Meta on each render, so flushing the segment is enough.
      revalidatePath(`/clients/${parsed.data.slug}/campaigns`);
      revalidatePath(`/clients/${parsed.data.slug}/adsets`);
      revalidatePath(`/clients/${parsed.data.slug}`);
      return { ok: true, newStatus: parsed.data.status };
    } catch (err) {
      lastErr = err;
      // Keep trying other accounts only if the error looks like "wrong owner".
      // For 4xx with a clear "permissions / not found", abort early.
      const msg =
        err instanceof MetaApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      if (
        msg.toLowerCase().includes("permission") ||
        msg.toLowerCase().includes("billing") ||
        msg.toLowerCase().includes("disabled")
      ) {
        return { error: `Meta refused: ${msg}` };
      }
    }
  }
  const msg =
    lastErr instanceof MetaApiError
      ? lastErr.message
      : lastErr instanceof Error
        ? lastErr.message
        : "Unknown error from Meta";
  return { error: `Failed across all connected accounts: ${msg}` };
}
