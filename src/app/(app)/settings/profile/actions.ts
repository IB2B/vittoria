"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { safeAuditLog } from "@/lib/audit";

export type ProfileState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email", string>>;
};

const profileSchema = z.object({
  name: z.string().max(120).optional().or(z.literal("")),
  email: z
    .string()
    .email("Must be a valid email")
    .transform((s) => s.toLowerCase()),
});

export async function updateProfileAction(
  _prev: ProfileState | undefined,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    const fieldErrors: ProfileState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0] as keyof NonNullable<
        ProfileState["fieldErrors"]
      >;
      if (path) fieldErrors[path] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  // If email changed, make sure no other account already uses it.
  if (parsed.data.email !== user.email) {
    const taken = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (taken && taken.id !== user.id) {
      return {
        error: "That email is already in use.",
        fieldErrors: { email: "Already taken" },
      };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name?.trim() || null,
      email: parsed.data.email,
    },
  });

  await safeAuditLog({
    userId: user.id,
    action: "user.updateProfile",
    meta: { email: parsed.data.email },
  });

  revalidatePath("/settings/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}

export type PasswordState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<
    Record<"current" | "next" | "confirm", string>
  >;
};

const passwordSchema = z
  .object({
    current: z.string().min(1, "Required"),
    next: z
      .string()
      .min(8, "At least 8 characters")
      .max(128),
    confirm: z.string().min(1, "Required"),
  })
  .refine((d) => d.next === d.confirm, {
    path: ["confirm"],
    message: "Doesn't match the new password",
  });

export async function changePasswordAction(
  _prev: PasswordState | undefined,
  formData: FormData,
): Promise<PasswordState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const fieldErrors: PasswordState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0] as keyof NonNullable<
        PasswordState["fieldErrors"]
      >;
      if (path) fieldErrors[path] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) return { error: "Account not found." };

  const ok = await bcrypt.compare(parsed.data.current, row.passwordHash);
  if (!ok) {
    return {
      error: "Current password is wrong.",
      fieldErrors: { current: "Incorrect" },
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.next, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await safeAuditLog({
    userId: user.id,
    action: "user.changePassword",
    meta: {},
  });

  return { ok: true };
}
