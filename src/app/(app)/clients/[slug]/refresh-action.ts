"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { assertClientAccess } from "@/lib/clients";
import { getInsights } from "@/lib/meta";
import { presetToRange } from "@/lib/date-range";

export type RefreshState = {
  ok?: boolean;
  error?: string;
  syncedAt?: string;
};

export async function refreshClientAction(
  _prev: RefreshState | undefined,
  formData: FormData,
): Promise<RefreshState> {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const presetRaw = String(formData.get("preset") ?? "30d");

  const client = await prisma.client.findUnique({
    where: { slug },
    include: { adAccounts: true },
  });
  if (!client) return { error: "Client not found" };
  assertClientAccess(user, client.id);

  if (client.adAccounts.length === 0) {
    return { error: "No Meta ad account connected." };
  }

  const range = presetToRange(presetRaw as Parameters<typeof presetToRange>[0]);

  const errors: string[] = [];
  for (const account of client.adAccounts) {
    try {
      await getInsights({
        adAccountId: account.id,
        range,
        forceRefresh: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      errors.push(`${account.metaAccountId}: ${message}`);
      await prisma.adAccount.update({
        where: { id: account.id },
        data: { lastSyncError: message },
      });
    }
  }

  revalidatePath(`/clients/${slug}`, "layout");

  if (errors.length > 0) return { error: errors.join("; ") };
  return { ok: true, syncedAt: new Date().toISOString() };
}
