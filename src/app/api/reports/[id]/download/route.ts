import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { assertClientAccess } from "@/lib/clients";
import { assembleReportInput } from "@/lib/reports/assemble";
import { buildReportDoc } from "@/lib/reports/buildReportDoc";
import type {
  PriorityTone,
  ReportLanguage,
  ReportNarrative,
  ReportPriority,
} from "@/lib/reports/types";
import type { SessionUser } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const user = session.user as unknown as SessionUser;

  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!report) return new NextResponse("Not found", { status: 404 });
  assertClientAccess(user, report.clientId);

  // Only DONE reports can be downloaded. PENDING/RUNNING return 425, FAILED
  // returns 500 with the captured error.
  if (report.status === "FAILED") {
    return new NextResponse(
      `Report build failed: ${report.errorMessage ?? "unknown"}`,
      { status: 500 },
    );
  }
  if (report.status !== "DONE") {
    return new NextResponse("Report is still building", { status: 425 });
  }

  const range = {
    since: report.rangeStart.toISOString().slice(0, 10),
    until: report.rangeEnd.toISOString().slice(0, 10),
  };

  const priorities = Array.isArray(report.prioritiesJson)
    ? (report.prioritiesJson as unknown as ReportPriority[])
    : undefined;

  const input = await assembleReportInput({
    clientId: report.clientId,
    range,
    language: report.language as ReportLanguage,
    generatedBy: user.email,
    priorities,
    contextNote: report.contextNote ?? undefined,
  });

  // Inject the AI narrative if the background build saved one.
  if (report.narrativeJson && typeof report.narrativeJson === "object") {
    input.narrative = report.narrativeJson as unknown as ReportNarrative;
  }

  const buffer = await buildReportDoc(input);

  const datePart = report.rangeEnd.toISOString().slice(0, 10);
  const filename = `Report_${report.client.slug.replace(/-/g, "_")}_${datePart}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// Re-expose the imported type for downstream consumers.
export type _UnusedPriorityTone = PriorityTone;
