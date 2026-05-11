import { prisma } from "@/lib/db";

// Audit logs are telemetry, not load-bearing data. A failure to write one
// (e.g. stale session userId after a DB swap) must NOT crash a user-facing
// action. Swallow + log; surface to Sentry-equivalent later if we add one.
export async function safeAuditLog(
  data: Parameters<typeof prisma.auditLog.create>[0]["data"],
): Promise<void> {
  try {
    await prisma.auditLog.create({ data });
  } catch (err) {
    console.warn(
      "[audit] failed to write audit log",
      data.action,
      err instanceof Error ? err.message : err,
    );
  }
}
