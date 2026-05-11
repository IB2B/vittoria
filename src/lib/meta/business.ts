import { metaGetAllPages } from "./client";

export type AccessibleAdAccount = {
  id: string;
  name: string;
  accountId: string;
  currency: string;
  timezone: string;
  status: number;
  businessId?: string;
  businessName?: string;
};

type RawAdAccount = {
  id: string;
  name?: string;
  account_id?: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
  business?: { id: string; name: string };
};

export async function listAccessibleAdAccounts(
  accessToken: string,
): Promise<AccessibleAdAccount[]> {
  const rows = await metaGetAllPages<RawAdAccount>(
    "me/adaccounts",
    {
      fields: [
        "id",
        "name",
        "account_id",
        "currency",
        "timezone_name",
        "account_status",
        "business",
      ],
      limit: 100,
    },
    { accessToken },
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? r.id,
    accountId: r.account_id ?? r.id.replace(/^act_/, ""),
    currency: r.currency ?? "EUR",
    timezone: r.timezone_name ?? "Europe/Rome",
    status: r.account_status ?? 0,
    businessId: r.business?.id,
    businessName: r.business?.name,
  }));
}

export const ACCOUNT_STATUS_LABEL: Record<number, string> = {
  1: "Active",
  2: "Disabled",
  3: "Unsettled",
  7: "Pending risk review",
  8: "Pending settlement",
  9: "In grace period",
  100: "Pending closure",
  101: "Closed",
};

export function accountStatusLabel(status: number): string {
  return ACCOUNT_STATUS_LABEL[status] ?? `Status ${status}`;
}
