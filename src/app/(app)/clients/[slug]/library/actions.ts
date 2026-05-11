"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ClientLibraryItemType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { assertClientAccess } from "@/lib/clients";
import { canMutate } from "@/lib/permissions";
import { encryptToken, decryptToken } from "@/lib/crypto";
import { safeAuditLog } from "@/lib/audit";

const TYPES = ["NOTE", "CREDENTIAL", "LINK"] as const;

const createSchema = z.object({
  clientId: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum(TYPES),
  title: z.string().min(1, "Title is required").max(160),
  body: z.string().max(16000).optional().or(z.literal("")),
  tags: z.string().max(400).optional().or(z.literal("")),
  pinned: z.union([z.literal("true"), z.literal("false")]).optional(),
});

export type LibraryState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"title" | "body" | "tags", string>>;
  itemId?: string;
};

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export async function createLibraryItemAction(
  _prev: LibraryState | undefined,
  formData: FormData,
): Promise<LibraryState> {
  const user = await requireUser();
  if (!canMutate(user)) {
    return { error: "Read-only role — can't add library items." };
  }
  const parsed = createSchema.safeParse({
    clientId: formData.get("clientId"),
    slug: formData.get("slug"),
    type: formData.get("type"),
    title: formData.get("title"),
    body: formData.get("body"),
    tags: formData.get("tags"),
    pinned: formData.get("pinned"),
  });
  if (!parsed.success) {
    const fieldErrors: LibraryState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0] as keyof NonNullable<
        LibraryState["fieldErrors"]
      >;
      if (path) fieldErrors[path] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  assertClientAccess(user, parsed.data.clientId);

  // Credentials get AES-256-GCM at rest; notes/links stay in plaintext so we
  // can search them and surface them inline without an extra round-trip.
  const isCredential = parsed.data.type === "CREDENTIAL";
  const bodyText = parsed.data.body ?? "";

  const item = await prisma.clientLibraryItem.create({
    data: {
      clientId: parsed.data.clientId,
      type: parsed.data.type as ClientLibraryItemType,
      title: parsed.data.title.trim(),
      body: isCredential ? null : bodyText || null,
      bodyEnc: isCredential && bodyText ? encryptToken(bodyText) : null,
      tags: parseTags(parsed.data.tags ?? ""),
      pinned: parsed.data.pinned === "true",
      createdBy: user.id,
    },
  });

  await safeAuditLog({
    userId: user.id,
    action: "library.create",
    meta: {
      clientId: parsed.data.clientId,
      itemId: item.id,
      type: parsed.data.type,
    },
  });

  revalidatePath(`/clients/${parsed.data.slug}/library`);
  return { ok: true, itemId: item.id };
}

const updateSchema = createSchema.extend({
  itemId: z.string().min(1),
});

export async function updateLibraryItemAction(
  _prev: LibraryState | undefined,
  formData: FormData,
): Promise<LibraryState> {
  const user = await requireUser();
  if (!canMutate(user)) return { error: "Read-only role — can't edit." };
  const parsed = updateSchema.safeParse({
    itemId: formData.get("itemId"),
    clientId: formData.get("clientId"),
    slug: formData.get("slug"),
    type: formData.get("type"),
    title: formData.get("title"),
    body: formData.get("body"),
    tags: formData.get("tags"),
    pinned: formData.get("pinned"),
  });
  if (!parsed.success) return { error: "Invalid update payload." };
  assertClientAccess(user, parsed.data.clientId);

  const isCredential = parsed.data.type === "CREDENTIAL";
  const bodyText = parsed.data.body ?? "";

  await prisma.clientLibraryItem.update({
    where: { id: parsed.data.itemId },
    data: {
      title: parsed.data.title.trim(),
      type: parsed.data.type as ClientLibraryItemType,
      body: isCredential ? null : bodyText || null,
      bodyEnc: isCredential && bodyText ? encryptToken(bodyText) : null,
      tags: parseTags(parsed.data.tags ?? ""),
      pinned: parsed.data.pinned === "true",
    },
  });

  await safeAuditLog({
    userId: user.id,
    action: "library.update",
    meta: { itemId: parsed.data.itemId, type: parsed.data.type },
  });

  revalidatePath(`/clients/${parsed.data.slug}/library`);
  return { ok: true, itemId: parsed.data.itemId };
}

const deleteSchema = z.object({
  itemId: z.string().min(1),
  slug: z.string().min(1),
});

export async function deleteLibraryItemAction(formData: FormData) {
  const user = await requireUser();
  if (!canMutate(user)) return;
  const parsed = deleteSchema.safeParse({
    itemId: formData.get("itemId"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return;
  const item = await prisma.clientLibraryItem.findUnique({
    where: { id: parsed.data.itemId },
    select: { clientId: true },
  });
  if (!item) return;
  assertClientAccess(user, item.clientId);
  await prisma.clientLibraryItem.delete({ where: { id: parsed.data.itemId } });
  await safeAuditLog({
    userId: user.id,
    action: "library.delete",
    meta: { itemId: parsed.data.itemId },
  });
  revalidatePath(`/clients/${parsed.data.slug}/library`);
}

export type RevealState = {
  ok?: boolean;
  error?: string;
  value?: string;
};

// Returns the decrypted credential body. Audit-logs every reveal so admins
// can see who looked at what when.
export async function revealCredentialAction(
  itemId: string,
): Promise<RevealState> {
  const user = await requireUser();
  const item = await prisma.clientLibraryItem.findUnique({
    where: { id: itemId },
    select: { clientId: true, type: true, bodyEnc: true, title: true },
  });
  if (!item) return { error: "Not found" };
  assertClientAccess(user, item.clientId);
  if (item.type !== "CREDENTIAL") {
    return { error: "Not a credential" };
  }
  if (!item.bodyEnc) return { ok: true, value: "" };
  let plain: string;
  try {
    plain = decryptToken(item.bodyEnc);
  } catch {
    return { error: "Decryption failed — server key may have rotated." };
  }
  await safeAuditLog({
    userId: user.id,
    action: "library.reveal",
    meta: { itemId, clientId: item.clientId, title: item.title },
  });
  return { ok: true, value: plain };
}

const togglePinSchema = z.object({
  itemId: z.string().min(1),
  slug: z.string().min(1),
});

export async function toggleLibraryPinAction(formData: FormData) {
  const user = await requireUser();
  if (!canMutate(user)) return;
  const parsed = togglePinSchema.safeParse({
    itemId: formData.get("itemId"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return;
  const item = await prisma.clientLibraryItem.findUnique({
    where: { id: parsed.data.itemId },
    select: { clientId: true, pinned: true },
  });
  if (!item) return;
  assertClientAccess(user, item.clientId);
  await prisma.clientLibraryItem.update({
    where: { id: parsed.data.itemId },
    data: { pinned: !item.pinned },
  });
  revalidatePath(`/clients/${parsed.data.slug}/library`);
}
