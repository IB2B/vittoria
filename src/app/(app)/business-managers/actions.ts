"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth-helpers";
import { safeAuditLog } from "@/lib/audit";
import { ALL_BMS, setActiveBm } from "@/lib/business-managers";

import { UNASSIGNED_BM } from "./constants";

const schema = z.object({
  businessId: z.string().min(1).max(64),
});

export type DisconnectState = {
  ok?: boolean;
  error?: string;
  deletedClients?: number;
  detachedAccounts?: number;
};

export async function disconnectBmAction(
  _prev: DisconnectState | undefined,
  formData: FormData,
): Promise<DisconnectState> {
  const user = await requireManager();
  const parsed = schema.safeParse({ businessId: formData.get("businessId") });
  if (!parsed.success) return { error: "Invalid Business Manager id." };

  const businessId = parsed.data.businessId;
  const isUnassigned = businessId === UNASSIGNED_BM;

  // 1. Find every ad account in this BM and the clients they belong to.
  const accountWhere = isUnassigned
    ? { businessId: null, channel: "META" as const }
    : { businessId, channel: "META" as const };
  const accounts = await prisma.adAccount.findMany({
    where: accountWhere,
    select: { id: true, clientId: true, metaAccountId: true },
  });
  if (accounts.length === 0) {
    return { error: "No ad accounts found for that Business Manager." };
  }

  const clientIds = [...new Set(accounts.map((a) => a.clientId))];

  // 2. Of those clients, which still have ad accounts under OTHER BMs? Those
  //    we keep — only their accounts in *this* BM get detached. The rest are
  //    orphans and get deleted (cascades to AdAccount, SyncSnapshot, Order,
  //    Report, ChannelStat per schema).
  // Survivor = a client that ALSO has ad accounts NOT in this disconnect set.
  const survivorAccountClause = isUnassigned
    ? {
        OR: [
          { businessId: { not: null } },
          { channel: { not: "META" as const } },
        ],
      }
    : {
        OR: [
          { businessId: { not: businessId } },
          { channel: { not: "META" as const } },
        ],
      };
  const survivors = await prisma.client.findMany({
    where: {
      id: { in: clientIds },
      adAccounts: { some: survivorAccountClause },
    },
    select: { id: true },
  });
  const survivorSet = new Set(survivors.map((c) => c.id));
  const orphanClientIds = clientIds.filter((id) => !survivorSet.has(id));

  let deletedClients = 0;
  let detachedAccounts = 0;

  if (orphanClientIds.length > 0) {
    const result = await prisma.client.deleteMany({
      where: { id: { in: orphanClientIds } },
    });
    deletedClients = result.count;
  }
  if (survivorSet.size > 0) {
    const detachWhere = isUnassigned
      ? {
          clientId: { in: [...survivorSet] },
          businessId: null,
          channel: "META" as const,
        }
      : {
          clientId: { in: [...survivorSet] },
          businessId,
          channel: "META" as const,
        };
    const result = await prisma.adAccount.deleteMany({ where: detachWhere });
    detachedAccounts = result.count;
  }

  // If the active BM cookie was set to the one we just deleted, reset it.
  await setActiveBm(ALL_BMS);

  await safeAuditLog({
    userId: user.id,
    action: "businessManager.disconnect",
    meta: {
      businessId,
      deletedClients,
      detachedAccounts,
      affectedClientIds: clientIds,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true, deletedClients, detachedAccounts };
}

const editSchema = z.object({
  // The current businessId, or `__unassigned__` for the legacy NULL bucket.
  currentBusinessId: z.string().min(1).max(64),
  // What we want to name it.
  name: z.string().min(1, "Name is required").max(160),
  // Optional Meta BM ID. If omitted and the current bucket is unassigned, we
  // mint a synthetic one so the bucket becomes a first-class BM. If omitted
  // for an already-named BM, we keep the existing businessId.
  newBusinessId: z.string().max(64).optional().or(z.literal("")),
});

export type EditState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "newBusinessId", string>>;
  updated?: number;
};

export async function editBmAction(
  _prev: EditState | undefined,
  formData: FormData,
): Promise<EditState> {
  const user = await requireManager();
  const parsed = editSchema.safeParse({
    currentBusinessId: formData.get("currentBusinessId"),
    name: formData.get("name"),
    newBusinessId: formData.get("newBusinessId"),
  });
  if (!parsed.success) {
    const fieldErrors: EditState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0] as keyof NonNullable<EditState["fieldErrors"]>;
      if (path) fieldErrors[path] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const wasUnassigned = parsed.data.currentBusinessId === UNASSIGNED_BM;

  // Resolve the businessId we'll write. If the user supplied a Meta BM ID,
  // use that (and assert no other BM is using it). Otherwise: keep current,
  // or mint a synthetic one for the unassigned bucket.
  let nextBusinessId: string;
  if (parsed.data.newBusinessId && parsed.data.newBusinessId.length > 0) {
    nextBusinessId = parsed.data.newBusinessId.trim();
    const conflict = await prisma.adAccount.findFirst({
      where: {
        businessId: nextBusinessId,
        ...(wasUnassigned
          ? {}
          : { businessId: { not: parsed.data.currentBusinessId } }),
      },
      select: { businessName: true },
    });
    if (
      conflict &&
      conflict.businessName &&
      conflict.businessName !== parsed.data.name
    ) {
      return {
        error: `BM ID is already in use by "${conflict.businessName}".`,
        fieldErrors: { newBusinessId: "Already in use" },
      };
    }
  } else if (wasUnassigned) {
    nextBusinessId = `vittoria_bm_${randomBytes(6).toString("hex")}`;
  } else {
    nextBusinessId = parsed.data.currentBusinessId;
  }

  // Apply the rename + ID update across every matching ad account.
  const where = wasUnassigned
    ? { businessId: null, channel: "META" as const }
    : {
        businessId: parsed.data.currentBusinessId,
        channel: "META" as const,
      };
  const result = await prisma.adAccount.updateMany({
    where,
    data: {
      businessId: nextBusinessId,
      businessName: parsed.data.name,
    },
  });

  await safeAuditLog({
    userId: user.id,
    action: "businessManager.edit",
    meta: {
      from: parsed.data.currentBusinessId,
      to: nextBusinessId,
      name: parsed.data.name,
      updated: result.count,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true, updated: result.count };
}

const mergeSchema = z.object({
  // Source can be UNASSIGNED_BM for the legacy NULL bucket, or a real BM id.
  sourceBusinessId: z.string().min(1).max(64),
  targetBusinessId: z.string().min(1).max(64),
});

export type MergeState = {
  ok?: boolean;
  error?: string;
  moved?: number;
};

export async function mergeBmAction(
  _prev: MergeState | undefined,
  formData: FormData,
): Promise<MergeState> {
  const user = await requireManager();
  const parsed = mergeSchema.safeParse({
    sourceBusinessId: formData.get("sourceBusinessId"),
    targetBusinessId: formData.get("targetBusinessId"),
  });
  if (!parsed.success) return { error: "Invalid merge payload." };
  if (parsed.data.sourceBusinessId === parsed.data.targetBusinessId) {
    return { error: "Source and target are the same BM." };
  }

  // Look up the target's display name (one row is enough — every account in
  // a BM shares the same name).
  const targetSample = await prisma.adAccount.findFirst({
    where: { businessId: parsed.data.targetBusinessId, channel: "META" },
    select: { businessName: true },
  });
  if (!targetSample) {
    return { error: "Target BM has no ad accounts." };
  }

  const sourceWhere =
    parsed.data.sourceBusinessId === UNASSIGNED_BM
      ? { businessId: null, channel: "META" as const }
      : {
          businessId: parsed.data.sourceBusinessId,
          channel: "META" as const,
        };

  const result = await prisma.adAccount.updateMany({
    where: sourceWhere,
    data: {
      businessId: parsed.data.targetBusinessId,
      businessName: targetSample.businessName,
    },
  });

  await safeAuditLog({
    userId: user.id,
    action: "businessManager.merge",
    meta: {
      from: parsed.data.sourceBusinessId,
      to: parsed.data.targetBusinessId,
      moved: result.count,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true, moved: result.count };
}

