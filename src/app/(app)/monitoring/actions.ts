"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { MonitoringStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth-helpers";
import { safeAuditLog } from "@/lib/audit";
import { runMonitoring } from "@/lib/monitoring/runner";
import { enhanceAllOpenAlerts } from "@/lib/monitoring/ai-enhance";

const transitionSchema = z.object({
  alertId: z.string().min(1),
  status: z.enum(["RESOLVED", "DISMISSED", "OPEN"]),
});

export type TransitionState = {
  ok?: boolean;
  error?: string;
};

export async function transitionAlertAction(
  _prev: TransitionState | undefined,
  formData: FormData,
): Promise<TransitionState> {
  const user = await requireManager();
  const parsed = transitionSchema.safeParse({
    alertId: formData.get("alertId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Invalid input" };

  const update: {
    status: MonitoringStatus;
    resolvedAt: Date | null;
    resolvedBy: string | null;
  } = {
    status: parsed.data.status as MonitoringStatus,
    resolvedAt: parsed.data.status === "OPEN" ? null : new Date(),
    resolvedBy: parsed.data.status === "OPEN" ? null : user.id,
  };

  await prisma.monitoringAlert.update({
    where: { id: parsed.data.alertId },
    data: update,
  });
  await safeAuditLog({
    userId: user.id,
    action: `monitoring.${parsed.data.status.toLowerCase()}`,
    meta: { alertId: parsed.data.alertId },
  });
  revalidatePath("/monitoring");
  return { ok: true };
}

// Manual "run now" — exposed on the page so admins can force a sweep
// without waiting for the nightly cron. Useful right after launch or when
// validating a fix.
export async function runMonitoringNowAction(): Promise<{
  ok: boolean;
  alertsCreated?: number;
  alertsRefreshed?: number;
  error?: string;
}> {
  const user = await requireManager();
  try {
    const r = await runMonitoring();
    const e = await enhanceAllOpenAlerts();
    await safeAuditLog({
      userId: user.id,
      action: "monitoring.runNow",
      meta: { ...r, enhancement: e },
    });
    revalidatePath("/monitoring");
    return {
      ok: true,
      alertsCreated: r.alertsCreated,
      alertsRefreshed: r.alertsRefreshed,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Run failed" };
  }
}
