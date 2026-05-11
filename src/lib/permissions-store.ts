import { Role } from "@prisma/client";

import { prisma } from "@/lib/db";

export const PAGE_KEYS = [
  "dashboard",
  "reports",
  "clients",
  "business_managers",
  "import",
  "creative_lab",
  "business_intelligence",
  "reels_lab",
  "team",
] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: "Dashboard",
  reports: "Reports",
  clients: "Clients",
  business_managers: "Business Managers",
  import: "Connect account",
  creative_lab: "Creative Lab",
  business_intelligence: "Business Intelligence",
  reels_lab: "Reels Lab",
  team: "Team",
};

// Defaults applied the first time a role is asked about. ADMIN always has
// full access (we never strip its permissions, even via the editor — guards
// in the action enforce that).
export const DEFAULT_PERMISSIONS: Record<Role, PageKey[]> = {
  ADMIN: [...PAGE_KEYS],
  MANAGER: PAGE_KEYS.filter((k) => k !== "team"),
  VIEWER: ["dashboard", "reports", "clients", "business_intelligence"],
  CLIENT: ["dashboard", "reports"],
};

// Reads the permission set for a role from DB, seeding defaults if missing.
export async function getAllowedPages(role: Role): Promise<Set<PageKey>> {
  // ADMIN bypass — we never trust the DB to gate the admin out.
  if (role === Role.ADMIN) return new Set(DEFAULT_PERMISSIONS.ADMIN);

  const row = await prisma.rolePermission.findUnique({ where: { role } });
  if (row) {
    const arr = Array.isArray(row.permissions) ? row.permissions : [];
    return new Set(arr.filter((k): k is PageKey => typeof k === "string"));
  }
  const defaults = DEFAULT_PERMISSIONS[role];
  await prisma.rolePermission.create({
    data: { role, permissions: defaults as unknown as object },
  });
  return new Set(defaults);
}

export async function userCanAccessPage(
  role: Role,
  key: PageKey,
): Promise<boolean> {
  const allowed = await getAllowedPages(role);
  return allowed.has(key);
}

export async function setRolePermissions(
  role: Role,
  permissions: PageKey[],
): Promise<void> {
  if (role === Role.ADMIN) {
    throw new Error("ADMIN permissions are not editable.");
  }
  // Make sure we only persist known keys.
  const valid = permissions.filter((k) => PAGE_KEYS.includes(k));
  await prisma.rolePermission.upsert({
    where: { role },
    update: { permissions: valid as unknown as object },
    create: { role, permissions: valid as unknown as object },
  });
}
