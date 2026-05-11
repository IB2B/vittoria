import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { canAccessClient, ForbiddenError, type SessionUser } from "@/lib/permissions";
import { Role } from "@prisma/client";

export async function getClientForUser(
  slug: string,
  user: SessionUser,
) {
  const client = await prisma.client.findUnique({
    where: { slug },
    include: {
      adAccounts: {
        select: {
          id: true,
          metaAccountId: true,
          currency: true,
          timezone: true,
          lastSyncedAt: true,
          lastSyncError: true,
          tokenExpiresAt: true,
          channel: true,
        },
      },
    },
  });

  if (!client) notFound();
  // canAccessClient lets ADMIN/MANAGER/VIEWER through; CLIENT only sees their
  // own. Earlier this check rejected everyone but MANAGER, which 404'd ADMINs.
  if (!canAccessClient(user, client.id)) notFound();
  return client;
}

export async function listClientsForUser(user: SessionUser) {
  if (
    user.role === Role.MANAGER ||
    user.role === Role.ADMIN ||
    user.role === Role.VIEWER
  ) {
    return prisma.client.findMany({
      orderBy: [{ archived: "asc" }, { name: "asc" }],
    });
  }
  if (!user.clientId) return [];
  const own = await prisma.client.findUnique({ where: { id: user.clientId } });
  return own ? [own] : [];
}

export function assertClientAccess(
  user: SessionUser,
  clientId: string,
): void {
  if (canAccessClient(user, clientId)) return;
  throw new ForbiddenError();
}
