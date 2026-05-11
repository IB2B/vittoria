"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth-helpers";
import { encryptToken } from "@/lib/crypto";
import { getAdAccount, MetaApiError } from "@/lib/meta";

const connectSchema = z.object({
  clientId: z.string().min(1),
  metaAccountId: z
    .string()
    .min(3)
    .regex(/^act_\d+$/u, 'Must look like "act_123456789"'),
  accessToken: z.string().min(20, "Token looks too short"),
});

export type ConnectAccountState = {
  error?: string;
  fieldErrors?: Partial<Record<"metaAccountId" | "accessToken", string>>;
  ok?: boolean;
};

export async function connectAdAccountAction(
  _prev: ConnectAccountState | undefined,
  formData: FormData,
): Promise<ConnectAccountState> {
  const user = await requireManager();
  const parsed = connectSchema.safeParse({
    clientId: formData.get("clientId"),
    metaAccountId: formData.get("metaAccountId"),
    accessToken: formData.get("accessToken"),
  });

  if (!parsed.success) {
    const fieldErrors: ConnectAccountState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0] as keyof NonNullable<
        ConnectAccountState["fieldErrors"]
      >;
      if (path) fieldErrors[path] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  // Validate the token by hitting Meta once.
  let metaInfo;
  try {
    metaInfo = await getAdAccount({
      metaAccountId: parsed.data.metaAccountId,
      accessToken: parsed.data.accessToken,
    });
  } catch (err) {
    const msg =
      err instanceof MetaApiError
        ? `Meta rejected the token (${err.code}): ${err.message}`
        : "Couldn't reach Meta. Check the token and account ID.";
    return { error: msg };
  }

  await prisma.adAccount.upsert({
    where: {
      clientId_metaAccountId: {
        clientId: parsed.data.clientId,
        metaAccountId: parsed.data.metaAccountId,
      },
    },
    update: {
      accessTokenEnc: encryptToken(parsed.data.accessToken),
      currency: metaInfo.currency,
      timezone: metaInfo.timezone_name,
      lastSyncError: null,
    },
    create: {
      clientId: parsed.data.clientId,
      metaAccountId: parsed.data.metaAccountId,
      accessTokenEnc: encryptToken(parsed.data.accessToken),
      currency: metaInfo.currency,
      timezone: metaInfo.timezone_name,
      channel: "META",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "adAccount.connect",
      meta: {
        clientId: parsed.data.clientId,
        metaAccountId: parsed.data.metaAccountId,
        accountName: metaInfo.name,
      },
    },
  });

  revalidatePath(`/clients`, "layout");
  return { ok: true };
}

const disconnectSchema = z.object({
  adAccountId: z.string().min(1),
  slug: z.string().min(1),
});

export async function disconnectAdAccountAction(formData: FormData) {
  const user = await requireManager();
  const parsed = disconnectSchema.safeParse({
    adAccountId: formData.get("adAccountId"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return;

  await prisma.adAccount.delete({ where: { id: parsed.data.adAccountId } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "adAccount.disconnect",
      meta: { adAccountId: parsed.data.adAccountId },
    },
  });
  revalidatePath(`/clients/${parsed.data.slug}/settings`);
}
