"use server";

import { after } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { assertClientAccess } from "@/lib/clients";
import { safeAuditLog } from "@/lib/audit";
import { runReportBuild } from "@/lib/reports/background-build";
import type { ReportPriority, PriorityTone } from "@/lib/reports/types";

const TONES: PriorityTone[] = [
  "meta",
  "google",
  "good",
  "warn",
  "bad",
  "brand",
  "accent",
  "purple",
];

const schema = z.object({
  clientId: z.string().min(1),
  slug: z.string().min(1),
  rangeStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  rangeEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  language: z.enum(["it", "en"]),
  contextNote: z.string().max(2000).optional().or(z.literal("")),
  priorities: z.string().optional().or(z.literal("")),
});

export type StartReportState = {
  ok?: boolean;
  reportId?: string;
  error?: string;
};

export async function startReportAction(
  _prev: StartReportState | undefined,
  formData: FormData,
): Promise<StartReportState> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    clientId: formData.get("clientId"),
    slug: formData.get("slug"),
    rangeStart: formData.get("rangeStart"),
    rangeEnd: formData.get("rangeEnd"),
    language: formData.get("language"),
    contextNote: formData.get("contextNote"),
    priorities: formData.get("priorities"),
  });
  if (!parsed.success) return { error: "Invalid report request." };
  assertClientAccess(user, parsed.data.clientId);

  let priorities: ReportPriority[] = [];
  if (parsed.data.priorities) {
    try {
      const raw = JSON.parse(parsed.data.priorities) as unknown;
      if (Array.isArray(raw)) {
        priorities = raw
          .filter(
            (p): p is { tone: string; tag: string; title: string; body: string } =>
              p !== null &&
              typeof p === "object" &&
              "tag" in p &&
              "title" in p &&
              "body" in p,
          )
          .map((p) => ({
            tone: TONES.includes(p.tone as PriorityTone)
              ? (p.tone as PriorityTone)
              : "brand",
            tag: String(p.tag).slice(0, 32),
            title: String(p.title).slice(0, 120),
            body: String(p.body).slice(0, 1000),
          }));
      }
    } catch {
      // Ignore malformed priorities — we just won't include them.
    }
  }

  const report = await prisma.report.create({
    data: {
      clientId: parsed.data.clientId,
      rangeStart: new Date(parsed.data.rangeStart + "T00:00:00Z"),
      rangeEnd: new Date(parsed.data.rangeEnd + "T23:59:59Z"),
      generatedBy: user.id,
      language: parsed.data.language,
      status: "PENDING",
      progress: 0,
      phaseLabel: "Queued",
      prioritiesJson:
        priorities.length > 0 ? (priorities as unknown as object) : undefined,
      contextNote: parsed.data.contextNote || null,
    },
  });

  await safeAuditLog({
    userId: user.id,
    action: "report.queue",
    meta: {
      clientId: parsed.data.clientId,
      reportId: report.id,
      language: parsed.data.language,
    },
  });

  // after() runs the work AFTER the response is returned to the client. The
  // user gets the reportId immediately and starts polling /api/reports/<id>/status
  // while the build (data load → Claude narrative → finalize) runs in the
  // background. Locally this is durable; on Vercel it survives the request
  // up to the function timeout (60s on Pro). For longer builds, a real queue
  // (Inngest / Trigger.dev) would replace this.
  after(async () => {
    await runReportBuild(report.id);
  });

  return { ok: true, reportId: report.id };
}
