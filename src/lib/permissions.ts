import { Role } from "@prisma/client";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "Unauthenticated") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  clientId?: string | null;
};

// Role hierarchy (most → least privileged):
// ADMIN  — everything (incl. team management, BM disconnect)
// MANAGER — everything except team management
// VIEWER  — read-only across all clients
// CLIENT  — read-only on their own client only
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  VIEWER: "Viewer",
  CLIENT: "Client",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN:
    "Full access. Can manage the team, disconnect BMs, and edit anything.",
  MANAGER:
    "Can connect/disconnect ad accounts, generate reports, edit settings — but cannot manage the team.",
  VIEWER: "Read-only across every client. Cannot edit, sync, or generate reports.",
  CLIENT: "Read-only access to a single linked client.",
};

export function isAdmin(user: SessionUser | null | undefined): boolean {
  return user?.role === Role.ADMIN;
}

export function isManager(user: SessionUser | null | undefined): boolean {
  return user?.role === Role.MANAGER || user?.role === Role.ADMIN;
}

export function canMutate(user: SessionUser | null | undefined): boolean {
  return user?.role === Role.ADMIN || user?.role === Role.MANAGER;
}

export function canAccessClient(
  user: SessionUser | null | undefined,
  clientId: string,
): boolean {
  if (!user) return false;
  if (
    user.role === Role.ADMIN ||
    user.role === Role.MANAGER ||
    user.role === Role.VIEWER
  ) {
    return true;
  }
  return user.clientId === clientId;
}

export function assertAdmin(user: SessionUser | null | undefined): void {
  if (!user) throw new UnauthenticatedError();
  if (user.role !== Role.ADMIN) throw new ForbiddenError();
}

export function assertManager(user: SessionUser | null | undefined): void {
  if (!user) throw new UnauthenticatedError();
  if (user.role !== Role.MANAGER && user.role !== Role.ADMIN) {
    throw new ForbiddenError();
  }
}

export function assertCanAccessClient(
  user: SessionUser | null | undefined,
  clientId: string,
): void {
  if (!user) throw new UnauthenticatedError();
  if (!canAccessClient(user, clientId)) throw new ForbiddenError();
}
