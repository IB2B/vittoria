import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { assertClientAccess } from "@/lib/clients";
import type { SessionUser } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as unknown as SessionUser;

  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      status: true,
      progress: true,
      phaseLabel: true,
      errorMessage: true,
      startedAt: true,
      completedAt: true,
    },
  });
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  assertClientAccess(user, report.clientId);

  return NextResponse.json(
    {
      id: report.id,
      status: report.status,
      progress: report.progress,
      phase: report.phaseLabel,
      error: report.errorMessage,
      started_at: report.startedAt?.toISOString() ?? null,
      completed_at: report.completedAt?.toISOString() ?? null,
      download_url:
        report.status === "DONE" ? `/api/reports/${report.id}/download` : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
