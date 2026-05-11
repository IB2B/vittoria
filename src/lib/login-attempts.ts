import { prisma } from "@/lib/db";

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 5;

export async function isLockedOut(email: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const failures = await prisma.loginAttempt.count({
    where: {
      email: email.toLowerCase(),
      success: false,
      createdAt: { gte: since },
    },
  });
  return failures >= MAX_FAILURES;
}

export async function recordAttempt(
  email: string,
  success: boolean,
  userId?: string | null,
  ipAddress?: string | null,
): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      email: email.toLowerCase(),
      success,
      userId: userId ?? null,
      ipAddress: ipAddress ?? null,
    },
  });
}
