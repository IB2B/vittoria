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
  listBusinessUsers,
  listPendingBusinessUsers,
  removeUserFromAdAccount,
  resolveUserIdFromEmail,
  type AdAccountTask,
  type BusinessUser,
  type PendingBusinessUser,
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
  let resolved;
  try {
    resolved = await resolveUserIdFromEmail({
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
  if (resolved.kind === "pending") {
    return {
      error: `${resolved.email} hasn't accepted the BM invite yet. Have them open the email from Meta and click Accept — then retry.`,
    };
  }
  if (resolved.kind === "not_found") {
    const sample = resolved.knownEmails.slice(0, 6).join(", ");
    return {
      error: sample
        ? `That email isn't a member of this BM. Meta sees these members: ${sample}${
            resolved.knownEmails.length > 6 ? "…" : ""
          }. Tip: use the picker below to choose from confirmed members.`
        : "That email isn't a member of this BM, and Meta returned no member emails (often a privacy/permissions setting). Try pasting the Meta user ID instead, or use the picker.",
    };
  }
  const userInfo = { id: resolved.id, name: resolved.name };

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

export type BmDirectoryEntry = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  status: "active" | "pending";
};

export type BmDirectoryResult = {
  members?: BmDirectoryEntry[];
  error?: string;
};

// Loads the BM directory (confirmed + pending members) for a given ad
// account. Used by the access picker so the user picks from what Meta
// actually sees rather than guessing emails. Admin-only.
export async function listBmDirectoryAction(
  adAccountId: string,
): Promise<BmDirectoryResult> {
  const user = await requireUser();
  if (!isAdmin(user)) return { error: "Admin-only." };

  const account = await prisma.adAccount.findUnique({
    where: { id: adAccountId },
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
  let confirmed: BusinessUser[] = [];
  let pending: PendingBusinessUser[] = [];
  try {
    [confirmed, pending] = await Promise.all([
      listBusinessUsers({
        businessId: realBusinessId,
        accessToken: token,
        bucketKey: `${account.id}:bm-users`,
      }),
      listPendingBusinessUsers({
        businessId: realBusinessId,
        accessToken: token,
        bucketKey: `${account.id}:bm-pending`,
      }),
    ]);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Couldn't load BM directory: ${err.message}`
          : "Couldn't load BM directory.",
    };
  }

  const members: BmDirectoryEntry[] = [
    ...confirmed.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: "active" as const,
    })),
    ...pending.map((p) => ({
      id: p.id,
      name: p.email ?? "Pending invite",
      email: p.email,
      role: p.role,
      status: "pending" as const,
    })),
  ];
  return { members };
}
