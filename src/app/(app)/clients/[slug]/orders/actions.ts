"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { assertClientAccess } from "@/lib/clients";

const createSchema = z.object({
  clientId: z.string().min(1),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Use yyyy-mm-dd"),
  value: z.coerce.number().positive("Must be positive"),
  reference: z.string().max(64).optional().or(z.literal("")),
  notes: z.string().max(280).optional().or(z.literal("")),
});

export type OrderActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<
    Record<"occurredAt" | "value" | "reference" | "notes", string>
  >;
};

export async function createOrderAction(
  _prev: OrderActionState | undefined,
  formData: FormData,
): Promise<OrderActionState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    clientId: formData.get("clientId"),
    occurredAt: formData.get("occurredAt"),
    value: formData.get("value"),
    reference: formData.get("reference"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    const fieldErrors: OrderActionState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0] as keyof NonNullable<
        OrderActionState["fieldErrors"]
      >;
      if (path) fieldErrors[path] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  assertClientAccess(user, parsed.data.clientId);

  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { slug: true, adAccounts: { select: { currency: true } } },
  });
  if (!client) return { error: "Client not found" };

  await prisma.order.create({
    data: {
      clientId: parsed.data.clientId,
      occurredAt: new Date(parsed.data.occurredAt + "T12:00:00Z"),
      value: parsed.data.value,
      reference: parsed.data.reference || null,
      notes: parsed.data.notes || null,
      createdBy: user.id,
      currency: client.adAccounts[0]?.currency ?? "EUR",
    },
  });

  revalidatePath(`/clients/${client.slug}`, "layout");
  return { ok: true };
}

const deleteSchema = z.object({
  orderId: z.string().min(1),
  slug: z.string().min(1),
});

export async function deleteOrderAction(formData: FormData) {
  const user = await requireUser();
  const parsed = deleteSchema.safeParse({
    orderId: formData.get("orderId"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return;

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    select: { clientId: true },
  });
  if (!order) return;
  assertClientAccess(user, order.clientId);

  await prisma.order.delete({ where: { id: parsed.data.orderId } });
  revalidatePath(`/clients/${parsed.data.slug}`, "layout");
}

// CSV columns expected: occurredAt,value,reference,notes
const csvSchema = z.object({
  clientId: z.string().min(1),
  csv: z.string().min(1),
});

export type CsvImportState = {
  ok?: boolean;
  error?: string;
  imported?: number;
  skipped?: number;
};

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export async function importOrdersCsvAction(
  _prev: CsvImportState | undefined,
  formData: FormData,
): Promise<CsvImportState> {
  const user = await requireUser();
  const parsed = csvSchema.safeParse({
    clientId: formData.get("clientId"),
    csv: formData.get("csv"),
  });
  if (!parsed.success) return { error: "Invalid input" };

  assertClientAccess(user, parsed.data.clientId);

  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { slug: true, adAccounts: { select: { currency: true } } },
  });
  if (!client) return { error: "Client not found" };

  const lines = parsed.data.csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { error: "Empty CSV" };

  const header = parseCsvRow(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = header.indexOf("occurredat");
  const valueIdx = header.indexOf("value");
  const refIdx = header.indexOf("reference");
  const notesIdx = header.indexOf("notes");

  if (dateIdx === -1 || valueIdx === -1) {
    return {
      error:
        "CSV must have header columns: occurredAt, value (optional: reference, notes).",
    };
  }

  const currency = client.adAccounts[0]?.currency ?? "EUR";
  let imported = 0;
  let skipped = 0;
  const today = new Date();

  for (const line of lines.slice(1)) {
    const cols = parseCsvRow(line);
    const dateStr = cols[dateIdx];
    const valueStr = cols[valueIdx];
    const value = Number(valueStr);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !Number.isFinite(value) || value <= 0) {
      skipped++;
      continue;
    }
    const occurredAt = new Date(dateStr + "T12:00:00Z");
    if (occurredAt > today) {
      skipped++;
      continue;
    }
    await prisma.order.create({
      data: {
        clientId: parsed.data.clientId,
        occurredAt,
        value,
        reference: refIdx >= 0 ? cols[refIdx] || null : null,
        notes: notesIdx >= 0 ? cols[notesIdx] || null : null,
        createdBy: user.id,
        currency,
      },
    });
    imported++;
  }

  revalidatePath(`/clients/${client.slug}`, "layout");
  return { ok: true, imported, skipped };
}
