import { NextResponse, type NextRequest } from "next/server";

import { runMonitoring } from "@/lib/monitoring/runner";
import { enhanceAllOpenAlerts } from "@/lib/monitoring/ai-enhance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Nightly monitoring sweep. Same Bearer-auth as /api/cron/sync. On Hostinger
// this runs at 23:59 via system cron; on Vercel Pro it can run on a vercel.json
// cron schedule.
export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/iu, "");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const result = await runMonitoring();
    const enhancement = await enhanceAllOpenAlerts();
    const ms = Date.now() - startedAt;
    return NextResponse.json(
      {
        ok: true,
        ...result,
        enhancement,
        durationMs: ms,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Monitoring run failed",
      },
      { status: 500 },
    );
  }
}
