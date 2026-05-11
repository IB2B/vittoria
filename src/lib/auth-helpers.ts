import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ForbiddenError, type SessionUser } from "@/lib/permissions";
import { userCanAccessPage, type PageKey } from "@/lib/permissions-store";
import { Role } from "@prisma/client";

// Returns the session user, but with name/email/role/clientId pulled FRESH
// from the DB rather than the JWT. Profile edits on /settings/profile would
// otherwise stay invisible until the user re-auths. The DB lookup is one
// indexed query per request — cheap.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const sessionUser = session.user as unknown as SessionUser;
  if (!sessionUser.id) return sessionUser;
  const fresh = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, email: true, name: true, role: true, clientId: true },
  });
  return fresh ?? sessionUser;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

// MANAGER and ADMIN both pass — both can mutate ad accounts, BMs, etc.
export async function requireManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== Role.MANAGER && user.role !== Role.ADMIN) {
    throw new ForbiddenError();
  }
  return user;
}

// ADMIN only — for team management.
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== Role.ADMIN) throw new ForbiddenError();
  return user;
}

// Page-level access check, gated by the DB-backed RolePermission table.
// ADMIN always passes. Throws ForbiddenError otherwise.
export async function requirePageAccess(key: PageKey): Promise<SessionUser> {
  const user = await requireUser();
  const allowed = await userCanAccessPage(user.role, key);
  if (!allowed) throw new ForbiddenError();
  return user;
}
