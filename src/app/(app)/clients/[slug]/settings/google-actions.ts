"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth-helpers";

const upsertSchema = z.object({
  clientId: z.string().min(1),
  rangeStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  rangeEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  spend: z.coerce.number().min(0),
  impressions: z.coerce.number().int().min(0).default(0),
  clicks: z.coerce.number().int().min(0).default(0),
  conversions: z.coerce.number().int().min(0).default(0),
  revenue: z.coerce.number().min(0).default(0),
  currency: z.string().min(2).max(8).default("EUR"),
  notes: z.string().max(280).optional().or(z.literal("")),
});

export type GoogleStatState = {
  ok?: boolean;
  error?: string;
};

export async function upsertGoogleStatAction(
  _prev: GoogleStatState | undefined,
  formData: FormData,
): Promise<GoogleStatState> {
  const user = await requireManager();
  const parsed = upsertSchema.safeParse({
    clientId: formData.get("clientId"),
    rangeStart: formData.get("rangeStart"),
    rangeEnd: formData.get("rangeEnd"),
    spend: formData.get("spend"),
    impressions: formData.get("impressions"),
    clicks: formData.get("clicks"),
    conversions: formData.get("conversions"),
    revenue: formData.get("revenue"),
    currency: formData.get("currency") || "EUR",
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: "Please fill in all required fields." };
  }
  if (parsed.data.rangeStart > parsed.data.rangeEnd) {
    return { error: "End date must be after start date." };
  }

  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { slug: true },
  });
  if (!client) return { error: "Client not found" };

  await prisma.channelStat.create({
    data: {
      clientId: parsed.data.clientId,
      channel: "GOOGLE",
      rangeStart: new Date(parsed.data.rangeStart + "T00:00:00Z"),
      rangeEnd: new Date(parsed.data.rangeEnd + "T23:59:59Z"),
      spend: parsed.data.spend,
      impressions: parsed.data.impressions,
      clicks: parsed.data.clicks,
      conversions: parsed.data.conversions,
      revenue: parsed.data.revenue,
      currency: parsed.data.currency,
      notes: parsed.data.notes || null,
      createdBy: user.id,
    },
  });

  revalidatePath(`/clients/${client.slug}`, "layout");
  return { ok: true };
}

const deleteSchema = z.object({
  statId: z.string().min(1),
  slug: z.string().min(1),
});

export async function deleteGoogleStatAction(formData: FormData) {
  await requireManager();
  const parsed = deleteSchema.safeParse({
    statId: formData.get("statId"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return;

  await prisma.channelStat.delete({ where: { id: parsed.data.statId } });
  revalidatePath(`/clients/${parsed.data.slug}`, "layout");
}
