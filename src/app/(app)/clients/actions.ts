"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth-helpers";
import { uniqueClientSlug } from "@/lib/slug";

const createSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(120),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/u, "Hex color e.g. #8B1538")
    .optional()
    .or(z.literal("")),
  logoUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
});

export type CreateClientState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "brandColor" | "logoUrl", string>>;
};

export async function createClientAction(
  _prev: CreateClientState | undefined,
  formData: FormData,
): Promise<CreateClientState> {
  const user = await requireManager();

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    brandColor: formData.get("brandColor"),
    logoUrl: formData.get("logoUrl"),
  });

  if (!parsed.success) {
    const fieldErrors: CreateClientState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0] as keyof NonNullable<
        CreateClientState["fieldErrors"]
      >;
      if (path) fieldErrors[path] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const slug = await uniqueClientSlug(parsed.data.name);
  const client = await prisma.client.create({
    data: {
      name: parsed.data.name,
      slug,
      brandColor: parsed.data.brandColor || null,
      logoUrl: parsed.data.logoUrl || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "client.create",
      meta: { clientId: client.id, slug: client.slug },
    },
  });

  revalidatePath("/clients");
  redirect(`/clients/${client.slug}`);
}

const archiveSchema = z.object({
  clientId: z.string().min(1),
  archived: z.union([z.literal("true"), z.literal("false")]),
});

export async function setArchivedAction(formData: FormData) {
  const user = await requireManager();
  const parsed = archiveSchema.safeParse({
    clientId: formData.get("clientId"),
    archived: formData.get("archived"),
  });
  if (!parsed.success) return;

  const archived = parsed.data.archived === "true";
  await prisma.client.update({
    where: { id: parsed.data.clientId },
    data: { archived },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: archived ? "client.archive" : "client.unarchive",
      meta: { clientId: parsed.data.clientId },
    },
  });
  revalidatePath("/clients");
}
