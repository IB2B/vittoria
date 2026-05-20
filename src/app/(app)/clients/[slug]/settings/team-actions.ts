"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/permissions";
import { decryptToken } from "@/lib/crypto";
import { safeAuditLog } from "@/lib/audit";
import {
  AD_ACCOUNT_TASKS,
  MetaApiError,
  assignUserToAdAccount,
  getOwningBusinessId,
  removeUserFromAdAccount,
  resolveUserIdFromEmail,
  type AdAccountTask,
} from "@/lib/meta";

// Some ad accounts in our DB carry a synthetic `vittoria_bm_*` businessId
// (minted when the user names an "Unassigned" BM via Edit dialog). Meta's
// user-management endpoints reject anything but a real BM id, so we ask
// Meta who owns the account and backfill our DB on the fly.
async function resolveRealBusinessId(account: {
  id: string;
  metaAccountId: string;
  accessTokenEnc: string;
  businessId: string | null;
}): Promise<string | null> {
  if (account.businessId && !account.businessId.startsWith("vittoria_bm_")) {
    return account.businessId;
  }
  const token = decryptToken(account.accessTokenEnc);
  const owner = await getOwningBusinessId({
    metaAccountId: account.metaAccountId,
    accessToken: token,
  });
  if (!owner) return null;
  await prisma.adAccount.update({
    where: { id: account.id },
    data: { businessId: owner.id, businessName: owner.name ?? undefined },
  });
  return owner.id;
}

const assignSchema = z.object({
  adAccountId: z.string().min(1),
  slug: z.string().min(1),
  emailOrUserId: z.string().min(3).max(160),
  tasks: z.string().min(1), // comma-separated list of AD_ACCOUNT_TASKS values
});

export type AssignState = {
  ok?: boolean;
  error?: string;
  assignedUserId?: string;
  assignedName?: string;
};

function parseTasks(raw: string): AdAccountTask[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is AdAccountTask =>
      (AD_ACCOUNT_TASKS as readonly string[]).includes(s),
    );
}

export async function assignUserAction(
  _prev: AssignState | undefined,
  formData: FormData,
): Promise<AssignState> {
  const user = await requireUser();
  if (!isAdmin(user)) {
    return { error: "Assigning ad-account access is admin-only." };
  }

  const parsed = assignSchema.safeParse({
    adAccountId: formData.get("adAccountId"),
    slug: formData.get("slug"),
    emailOrUserId: formData.get("emailOrUserId"),
    tasks: formData.get("tasks"),
  });
  if (!parsed.success) return { error: "Invalid input" };

  const tasks = parseTasks(parsed.data.tasks);
  if (tasks.length === 0) {
    return { error: "Pick at least one task (MANAGE / ADVERTISE / ANALYZE / …)." };
  }

  const account = await prisma.adAccount.findUnique({
    where: { id: parsed.data.adAccountId },
    select: {
      id: true,
      accessTokenEnc: true,
      metaAccountId: true,
      businessId: true,
      client: { select: { id: true, slug: true } },
    },
  });
  if (!account) return { error: "Ad account not found" };

  const realBusinessId = await resolveRealBusinessId(account);
  if (!realBusinessId) {
    return {
      error:
        "This ad account isn't tied to a Business Manager Meta recognises. Move it under a real BM in Meta Business Manager, then retry.",
    };
  }

  const token = decryptToken(account.accessTokenEnc);

  // Resolve email → FB user id by scanning BM membership. If the input is
  // already a numeric id we skip the lookup.
  let userInfo: { id: string; name?: string } | null = null;
  try {
    userInfo = await resolveUserIdFromEmail({
      businessId: realBusinessId,
      emailOrId: parsed.data.emailOrUserId,
      accessToken: token,
    });
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Couldn't look up user: ${err.message}`
          : "Couldn't look up user.",
    };
  }
  if (!userInfo) {
    return {
      error:
        "That email isn't a member of this Business Manager. Add them to the BM first (Meta Business Manager → People → Add).",
    };
  }

  try {
    await assignUserToAdAccount({
      adAccountId: account.metaAccountId,
      businessId: realBusinessId,
      userId: userInfo.id,
      tasks,
      accessToken: token,
    });
  } catch (err) {
    if (err instanceof MetaApiError) {
      return { error: `Meta rejected: ${err.message}` };
    }
    return {
      error: err instanceof Error ? err.message : "Failed to assign user",
    };
  }

  await safeAuditLog({
    userId: user.id,
    action: "metaUser.assign",
    meta: {
      adAccountId: account.id,
      metaAccountId: account.metaAccountId,
      targetUserId: userInfo.id,
      tasks,
    },
  });

  revalidatePath(`/clients/${parsed.data.slug}/settings`);
  return { ok: true, assignedUserId: userInfo.id, assignedName: userInfo.name };
}

const removeSchema = z.object({
  adAccountId: z.string().min(1),
  slug: z.string().min(1),
  userId: z.string().min(1),
});

export type RemoveState = {
  ok?: boolean;
  error?: string;
};

export async function removeUserAction(
  _prev: RemoveState | undefined,
  formData: FormData,
): Promise<RemoveState> {
  const user = await requireUser();
  if (!isAdmin(user)) {
    return { error: "Removing ad-account access is admin-only." };
  }

  const parsed = removeSchema.safeParse({
    adAccountId: formData.get("adAccountId"),
    slug: formData.get("slug"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "Invalid input" };

  const account = await prisma.adAccount.findUnique({
    where: { id: parsed.data.adAccountId },
    select: {
      id: true,
      accessTokenEnc: true,
      metaAccountId: true,
      businessId: true,
    },
  });
  if (!account) return { error: "Ad account not found" };

  const realBusinessId = await resolveRealBusinessId(account);
  if (!realBusinessId) {
    return {
      error:
        "This ad account isn't tied to a Business Manager Meta recognises.",
    };
  }

  const token = decryptToken(account.accessTokenEnc);
  try {
    await removeUserFromAdAccount({
      adAccountId: account.metaAccountId,
      businessId: realBusinessId,
      userId: parsed.data.userId,
      accessToken: token,
    });
  } catch (err) {
    if (err instanceof MetaApiError) {
      return { error: `Meta rejected: ${err.message}` };
    }
    return {
      error: err instanceof Error ? err.message : "Failed to remove user",
    };
  }

  await safeAuditLog({
    userId: user.id,
    action: "metaUser.remove",
    meta: {
      adAccountId: account.id,
      metaAccountId: account.metaAccountId,
      targetUserId: parsed.data.userId,
    },
  });

  revalidatePath(`/clients/${parsed.data.slug}/settings`);
  return { ok: true };
}
