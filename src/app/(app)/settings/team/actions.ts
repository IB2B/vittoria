"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { safeAuditLog } from "@/lib/audit";

const ROLES = ["ADMIN", "MANAGER", "VIEWER", "CLIENT"] as const;

export type InviteState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"email" | "name" | "role" | "clientId", string>>;
  generatedPassword?: string;
};

const inviteSchema = z
  .object({
    email: z
      .string()
      .email("Must be a valid email")
      .transform((s) => s.toLowerCase()),
    name: z.string().min(1).max(120),
    role: z.enum(ROLES),
    clientId: z.string().optional().or(z.literal("")),
  })
  .refine(
    (d) => (d.role === Role.CLIENT ? d.clientId && d.clientId.length > 0 : true),
    {
      path: ["clientId"],
      message: "Pick which client this account can see",
    },
  );

export async function inviteUserAction(
  _prev: InviteState | undefined,
  formData: FormData,
): Promise<InviteState> {
  const admin = await requireAdmin();
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    clientId: formData.get("clientId"),
  });
  if (!parsed.success) {
    const fieldErrors: InviteState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0] as keyof NonNullable<
        InviteState["fieldErrors"]
      >;
      if (path) fieldErrors[path] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const taken = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (taken) {
    return {
      error: "A user with that email already exists.",
      fieldErrors: { email: "Already in use" },
    };
  }

  // No transactional email yet — generate a strong temporary password and
  // surface it once on screen so the admin can hand it off out-of-band.
  const tempPassword = randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role as Role,
      clientId:
        parsed.data.role === Role.CLIENT ? parsed.data.clientId || null : null,
    },
  });

  await safeAuditLog({
    userId: admin.id,
    action: "team.invite",
    meta: {
      email: parsed.data.email,
      role: parsed.data.role,
      clientId:
        parsed.data.role === Role.CLIENT ? parsed.data.clientId : undefined,
    },
  });

  revalidatePath("/settings/team");
  return { ok: true, generatedPassword: tempPassword };
}

const updateSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES),
  clientId: z.string().optional().or(z.literal("")),
});

export type UpdateState = {
  ok?: boolean;
  error?: string;
};

export async function updateMemberAction(
  _prev: UpdateState | undefined,
  formData: FormData,
): Promise<UpdateState> {
  const admin = await requireAdmin();
  const parsed = updateSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    clientId: formData.get("clientId"),
  });
  if (!parsed.success) return { error: "Invalid input." };

  if (parsed.data.userId === admin.id && parsed.data.role !== Role.ADMIN) {
    return { error: "You can't demote yourself out of Admin." };
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      role: parsed.data.role as Role,
      clientId:
        parsed.data.role === Role.CLIENT ? parsed.data.clientId || null : null,
    },
  });

  await safeAuditLog({
    userId: admin.id,
    action: "team.updateRole",
    meta: { userId: parsed.data.userId, role: parsed.data.role },
  });

  revalidatePath("/settings/team");
  return { ok: true };
}

const removeSchema = z.object({ userId: z.string().min(1) });

export async function removeUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = removeSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return;
  if (parsed.data.userId === admin.id) return; // can't delete yourself

  await prisma.user.delete({ where: { id: parsed.data.userId } });
  await safeAuditLog({
    userId: admin.id,
    action: "team.remove",
    meta: { userId: parsed.data.userId },
  });
  revalidatePath("/settings/team");
}
