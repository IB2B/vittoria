"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth-helpers";
import { safeAuditLog } from "@/lib/audit";
import { encryptToken } from "@/lib/crypto";
import {
  clearPendingGoogleRefreshToken,
  getPendingGoogleRefreshToken,
} from "@/lib/google/session";
import { uniqueClientSlug } from "@/lib/slug";

const googleItemSchema = z.object({
  customerId: z.string().regex(/^\d{6,12}$/u),
  clientName: z.string().min(1).max(120),
  currency: z.string().min(2).max(8).default("EUR"),
  timezone: z.string().min(1).max(64).default("Europe/Rome"),
});

const importSchema = z.object({
  items: z.array(googleItemSchema).min(1).max(50),
});

export type GoogleImportState = {
  ok?: boolean;
  error?: string;
  imported?: number;
  reused?: number;
};

export async function importGoogleCustomersAction(
  _prev: GoogleImportState | undefined,
  formData: FormData,
): Promise<GoogleImportState> {
  const user = await requireManager();
  const refreshToken = await getPendingGoogleRefreshToken();
  if (!refreshToken) {
    return { error: "OAuth session expired. Please sign in with Google again." };
  }

  let parsedItems: unknown;
  try {
    parsedItems = JSON.parse(String(formData.get("items") ?? "null"));
  } catch {
    return { error: "Could not read selection." };
  }
  const parsed = importSchema.safeParse({ items: parsedItems });
  if (!parsed.success) {
    return { error: "Pick at least one customer." };
  }

  const tokenEnc = encryptToken(refreshToken);
  let imported = 0;
  let reused = 0;

  for (const item of parsed.data.items) {
    const existing = await prisma.adAccount.findFirst({
      where: { channel: "GOOGLE", metaAccountId: item.customerId },
      select: { id: true },
    });
    if (existing) {
      await prisma.adAccount.update({
        where: { id: existing.id },
        data: {
          accessTokenEnc: tokenEnc,
          currency: item.currency,
          timezone: item.timezone,
          lastSyncError: null,
        },
      });
      reused += 1;
      continue;
    }

    const slug = await uniqueClientSlug(item.clientName);
    const client = await prisma.client.create({
      data: { name: item.clientName, slug },
    });
    await prisma.adAccount.create({
      data: {
        clientId: client.id,
        channel: "GOOGLE",
        metaAccountId: item.customerId,
        accessTokenEnc: tokenEnc,
        currency: item.currency,
        timezone: item.timezone,
      },
    });
    imported += 1;
  }

  await safeAuditLog({
    userId: user.id,
    action: "adAccount.bulkImport",
    meta: {
      channel: "GOOGLE",
      imported,
      reused,
      ids: parsed.data.items.map((i) => i.customerId),
    },
  });

  await clearPendingGoogleRefreshToken();

  revalidatePath("/clients", "layout");
  revalidatePath("/dashboard");
  return { ok: true, imported, reused };
}

export async function cancelPendingGoogleSession() {
  await requireManager();
  await clearPendingGoogleRefreshToken();
  revalidatePath("/clients/import");
}
