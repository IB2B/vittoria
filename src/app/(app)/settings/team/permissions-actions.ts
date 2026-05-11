"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";

import { requireAdmin } from "@/lib/auth-helpers";
import { safeAuditLog } from "@/lib/audit";
import {
  PAGE_KEYS,
  setRolePermissions,
  type PageKey,
} from "@/lib/permissions-store";

const schema = z.object({
  role: z.enum(["MANAGER", "VIEWER", "CLIENT"]),
  permissions: z.string(),
});

export type PermissionsState = {
  ok?: boolean;
  error?: string;
};

export async function updateRolePermissionsAction(
  _prev: PermissionsState | undefined,
  formData: FormData,
): Promise<PermissionsState> {
  const admin = await requireAdmin();

  const parsed = schema.safeParse({
    role: formData.get("role"),
    permissions: formData.get("permissions"),
  });
  if (!parsed.success) return { error: "Invalid input." };

  let permissions: PageKey[];
  try {
    const raw = JSON.parse(parsed.data.permissions);
    if (!Array.isArray(raw)) throw new Error("not an array");
    permissions = raw.filter((k): k is PageKey =>
      typeof k === "string" && (PAGE_KEYS as readonly string[]).includes(k),
    );
  } catch {
    return { error: "Permissions payload is malformed." };
  }

  try {
    await setRolePermissions(parsed.data.role as Role, permissions);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to save",
    };
  }

  await safeAuditLog({
    userId: admin.id,
    action: "permissions.update",
    meta: { role: parsed.data.role, permissions },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
