import { ReportStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { assembleReportInput } from "./assemble";
import { generateReportNarrative } from "./ai-narrative";
import type { ReportLanguage, ReportPriority } from "./types";

// Drives a Report row through the async build pipeline. We don't keep the
// docx binary in DB — instead we persist the narrative + priorities + context
// note, and the download route rebuilds the .docx on demand from cached
// SyncSnapshot data + these fields.
//
// Phases:
// 10% — loading client + cached insights
// 40% — calling Claude for narrative (skipped if ANTHROPIC_API_KEY absent)
// 90% — narrative saved
// 100% — done
export async function runReportBuild(reportId: string): Promise<void> {
  await prisma.report.update({
    where: { id: reportId },
    data: {
      status: ReportStatus.RUNNING,
      progress: 10,
      phaseLabel: "Loading client data",
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  try {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: {
        clientId: true,
        rangeStart: true,
        rangeEnd: true,
        language: true,
        prioritiesJson: true,
        contextNote: true,
        generatedBy: true,
        user: { select: { email: true } },
      },
    });
    if (!report) return;

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
      generatedBy: report.user.email,
      priorities,
      contextNote: report.contextNote ?? undefined,
    });

    await prisma.report.update({
      where: { id: reportId },
      data: {
        progress: 40,
        phaseLabel: "Vittoria is writing the narrative",
      },
    });

    let narrative = null;
    try {
      narrative = await generateReportNarrative(input);
    } catch (err) {
      // Don't fail the whole build if Claude has a bad day — the report is
      // still useful without the AI section. Just record the issue.
      console.warn("[report-build] narrative failed:", err);
    }

    await prisma.report.update({
      where: { id: reportId },
      data: {
        progress: 90,
        phaseLabel: "Finalizing",
        narrativeJson: narrative
          ? (narrative as unknown as object)
          : undefined,
      },
    });

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.DONE,
        progress: 100,
        phaseLabel: "Ready to download",
        completedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.FAILED,
        errorMessage: err instanceof Error ? err.message : "Build failed",
      },
    });
  }
}
