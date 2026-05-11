import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { ALL_BMS, type BmOption } from "@/lib/business-managers-shared";

export { ALL_BMS, type BmOption };

const COOKIE_NAME = "vittoria_active_bm";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // a year

export async function listBusinessManagers(): Promise<BmOption[]> {
  // Group AdAccount rows by businessId. Rows with no businessId (legacy
  // imports) get bucketed under a synthetic "Unknown BM" so the user can
  // still see them.
  const rows = await prisma.adAccount.groupBy({
    by: ["businessId", "businessName"],
    where: { channel: "META" },
    _count: { clientId: true },
  });

  return rows
    .map((r) => ({
      id: r.businessId ?? "unassigned",
      name: r.businessName ?? "Unassigned",
      clientCount: r._count.clientId,
    }))
    .sort((a, b) => b.clientCount - a.clientCount);
}

export async function getActiveBm(): Promise<string> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value || ALL_BMS;
}

export async function setActiveBm(value: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, value, {
    httpOnly: false, // intentionally readable by client too
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

// Builds the prisma `where` filter that scopes a Client query to the active BM.
// Returns an empty object when "all" is selected.
export function whereClientInBm(activeBm: string) {
  if (activeBm === ALL_BMS) return {};
  if (activeBm === "unassigned") {
    return {
      adAccounts: {
        some: {
          channel: "META" as const,
          businessId: null,
        },
      },
    };
  }
  return {
    adAccounts: {
      some: {
        channel: "META" as const,
        businessId: activeBm,
      },
    },
  };
}
