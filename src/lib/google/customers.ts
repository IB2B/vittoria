import { getGoogleAdsConfig } from "./config";
import { refreshAccessToken } from "./oauth";

const API_VERSION = "v18";
const BASE = `https://googleads.googleapis.com/${API_VERSION}`;

export type GoogleCustomer = {
  customerId: string;
  descriptiveName: string;
  currency: string;
  timeZone: string;
  manager: boolean;
  testAccount: boolean;
};

function authHeaders(accessToken: string) {
  const cfg = getGoogleAdsConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": cfg.developerToken,
    "Content-Type": "application/json",
  };
  if (cfg.loginCustomerId) {
    headers["login-customer-id"] = cfg.loginCustomerId.replace(/-/g, "");
  }
  return headers;
}

export async function listAccessibleCustomers(
  refreshToken: string,
): Promise<string[]> {
  const { access_token } = await refreshAccessToken(refreshToken);
  const res = await fetch(`${BASE}/customers:listAccessibleCustomers`, {
    headers: authHeaders(access_token),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`listAccessibleCustomers failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { resourceNames?: string[] };
  return (json.resourceNames ?? []).map((r) => r.replace(/^customers\//, ""));
}

type SearchResult = {
  results?: Array<{
    customer?: {
      id: string;
      descriptiveName?: string;
      currencyCode?: string;
      timeZone?: string;
      manager?: boolean;
      testAccount?: boolean;
    };
  }>;
};

export async function getCustomerInfo(
  refreshToken: string,
  customerId: string,
): Promise<GoogleCustomer> {
  const { access_token } = await refreshAccessToken(refreshToken);
  const cleanId = customerId.replace(/-/g, "");
  const res = await fetch(`${BASE}/customers/${cleanId}/googleAds:searchStream`, {
    method: "POST",
    headers: authHeaders(access_token),
    body: JSON.stringify({
      query:
        "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.test_account FROM customer LIMIT 1",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`getCustomerInfo(${cleanId}) failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as SearchResult[] | SearchResult;
  const arr = Array.isArray(json) ? json : [json];
  const first = arr[0]?.results?.[0]?.customer;
  return {
    customerId: cleanId,
    descriptiveName: first?.descriptiveName ?? `Customer ${cleanId}`,
    currency: first?.currencyCode ?? "EUR",
    timeZone: first?.timeZone ?? "Europe/Rome",
    manager: !!first?.manager,
    testAccount: !!first?.testAccount,
  };
}

export async function listCustomersWithDetails(
  refreshToken: string,
): Promise<GoogleCustomer[]> {
  const ids = await listAccessibleCustomers(refreshToken);
  const out: GoogleCustomer[] = [];
  for (const id of ids) {
    try {
      out.push(await getCustomerInfo(refreshToken, id));
    } catch {
      out.push({
        customerId: id,
        descriptiveName: `Customer ${id}`,
        currency: "EUR",
        timeZone: "Europe/Rome",
        manager: false,
        testAccount: false,
      });
    }
  }
  return out;
}
