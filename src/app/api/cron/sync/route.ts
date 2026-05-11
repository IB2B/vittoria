import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";

import { prisma } from "@/lib/db";
import { getInsights } from "@/lib/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = "yyyy-MM-dd";

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  if (header === `Bearer ${expected}`) return true;
  // Vercel Cron sends a different header by convention; allow either.
  if (req.headers.get("x-cron-secret") === expected) return true;
  return false;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const today = new Date();
  const range = {
    since: format(subDays(today, 30), ISO),
    until: format(today, ISO),
  };

  const accounts = await prisma.adAccount.findMany({
    select: { id: true, metaAccountId: true, clientId: true },
  });

  const results: Array<{
    adAccountId: string;
    ok: boolean;
    error?: string;
    rows?: number;
  }> = [];

  for (const acc of accounts) {
    try {
      const data = await getInsights({
        adAccountId: acc.id,
        range,
        forceRefresh: true,
      });
      results.push({
        adAccountId: acc.id,
        ok: true,
        rows: data.rows.length,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown sync error";
      await prisma.adAccount.update({
        where: { id: acc.id },
        data: { lastSyncError: message },
      });
      results.push({ adAccountId: acc.id, ok: false, error: message });
    }
  }

  return NextResponse.json({ syncedAt: new Date().toISOString(), results });
}
