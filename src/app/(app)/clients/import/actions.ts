"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth-helpers";
import { safeAuditLog } from "@/lib/audit";
import { encryptToken } from "@/lib/crypto";
import {
  listAccessibleAdAccounts,
  MetaApiError,
  type AccessibleAdAccount,
} from "@/lib/meta";
import { uniqueClientSlug } from "@/lib/slug";

export type DiscoverState = {
  ok?: boolean;
  error?: string;
  accounts?: AccessibleAdAccount[];
  alreadyImported?: Record<string, { clientName: string; clientSlug: string }>;
};

const discoverSchema = z.object({
  accessToken: z.string().min(20, "Token looks too short"),
});

export async function discoverMetaAdAccountsAction(
  _prev: DiscoverState | undefined,
  formData: FormData,
): Promise<DiscoverState> {
  await requireManager();
  const parsed = discoverSchema.safeParse({
    accessToken: formData.get("accessToken"),
  });
  if (!parsed.success) {
    return { error: "Paste a valid System User token." };
  }

  let accounts: AccessibleAdAccount[];
  try {
    accounts = await listAccessibleAdAccounts(parsed.data.accessToken);
  } catch (err) {
    const msg =
      err instanceof MetaApiError
        ? `Meta rejected the token (${err.code}): ${err.message}`
        : "Couldn't reach Meta. Check the token.";
    return { error: msg };
  }

  if (accounts.length === 0) {
    return {
      error:
        "Token is valid but has access to 0 ad accounts. Check the System User's asset assignments in Business Manager.",
    };
  }

  const existing = await prisma.adAccount.findMany({
    where: {
      channel: "META",
      metaAccountId: { in: accounts.map((a) => a.id) },
    },
    select: {
      metaAccountId: true,
      client: { select: { name: true, slug: true } },
    },
  });
  const alreadyImported: Record<
    string,
    { clientName: string; clientSlug: string }
  > = {};
  for (const e of existing) {
    alreadyImported[e.metaAccountId] = {
      clientName: e.client.name,
      clientSlug: e.client.slug,
    };
  }

  return { ok: true, accounts, alreadyImported };
}

const importItemSchema = z.object({
  metaAccountId: z.string().regex(/^act_\d+$/u),
  clientName: z.string().min(1).max(120),
  currency: z.string().min(2).max(8).default("EUR"),
  timezone: z.string().min(1).max(64).default("Europe/Rome"),
  businessId: z.string().max(64).optional(),
  businessName: z.string().max(160).optional(),
});

const importSchema = z.object({
  accessToken: z.string().min(20),
  items: z.array(importItemSchema).min(1).max(50),
});

export type ImportState = {
  ok?: boolean;
  error?: string;
  imported?: number;
  reused?: number;
};

export async function importMetaAdAccountsAction(
  _prev: ImportState | undefined,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireManager();
  const rawItems = formData.get("items");
  let parsedItems: unknown;
  try {
    parsedItems = typeof rawItems === "string" ? JSON.parse(rawItems) : null;
  } catch {
    return { error: "Could not read selection." };
  }
  const parsed = importSchema.safeParse({
    accessToken: formData.get("accessToken"),
    items: parsedItems,
  });
  if (!parsed.success) {
    return { error: "Pick at least one ad account and confirm the token." };
  }

  const tokenEnc = encryptToken(parsed.data.accessToken);
  let imported = 0;
  let reused = 0;

  for (const item of parsed.data.items) {
    const existing = await prisma.adAccount.findFirst({
      where: { channel: "META", metaAccountId: item.metaAccountId },
      select: { id: true, clientId: true },
    });

    if (existing) {
      await prisma.adAccount.update({
        where: { id: existing.id },
        data: {
          accessTokenEnc: tokenEnc,
          currency: item.currency,
          timezone: item.timezone,
          businessId: item.businessId ?? null,
          businessName: item.businessName ?? null,
          lastSyncError: null,
        },
      });
      reused += 1;
      continue;
    }

    const slug = await uniqueClientSlug(item.clientName);
    const client = await prisma.client.create({
      data: {
        name: item.clientName,
        slug,
      },
    });
    await prisma.adAccount.create({
      data: {
        clientId: client.id,
        channel: "META",
        metaAccountId: item.metaAccountId,
        accessTokenEnc: tokenEnc,
        currency: item.currency,
        timezone: item.timezone,
        businessId: item.businessId ?? null,
        businessName: item.businessName ?? null,
      },
    });
    imported += 1;
  }

  await safeAuditLog({
    userId: user.id,
    action: "adAccount.bulkImport",
    meta: {
      channel: "META",
      imported,
      reused,
      ids: parsed.data.items.map((i) => i.metaAccountId),
    },
  });

  revalidatePath("/clients", "layout");
  revalidatePath("/dashboard");
  return { ok: true, imported, reused };
}
