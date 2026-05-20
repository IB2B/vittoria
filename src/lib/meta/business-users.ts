// Meta Business Manager user-assignment helpers. Lets agencies assign their
// existing BM members to specific ad accounts (or revoke that access) without
// leaving Vittoria.
//
// Token needs `business_management` scope (already on your existing tokens).
// All endpoints are documented under Meta's "Business Asset Group" API.

import { acquire } from "./rate-limit";
import { metaGet, metaGetAllPages, MetaApiError } from "./client";
import type { MetaApiError as MetaApiErrorPayload } from "./types";

const BASE = "https://graph.facebook.com";
const API_VERSION = process.env.META_API_VERSION ?? "v22.0";

// Tasks Meta accepts for ad-account assignment. MANAGE is admin; ADVERTISE
// is a general editor; ANALYZE is read-only.
export const AD_ACCOUNT_TASKS = [
  "MANAGE",
  "ADVERTISE",
  "ANALYZE",
  "DRAFT",
  "MANAGE_TEMPLATES",
] as const;
export type AdAccountTask = (typeof AD_ACCOUNT_TASKS)[number];

export type BusinessUser = {
  id: string;
  name: string;
  email?: string;
  role: string;
};

export type AssignedUser = {
  id: string;
  name: string;
  email?: string;
  tasks: string[];
};

// Lists every member of the Business Manager (humans, not system users).
export async function listBusinessUsers(params: {
  businessId: string;
  accessToken: string;
  bucketKey?: string;
}): Promise<BusinessUser[]> {
  return metaGetAllPages<BusinessUser>(
    `${params.businessId}/business_users`,
    { fields: ["id", "name", "email", "role"], limit: 100 },
    { accessToken: params.accessToken, bucketKey: params.bucketKey },
  );
}

// Lists every user currently assigned to a specific ad account, including
// their tasks (the permissions Meta exposes per assignment).
export async function listAdAccountAssignedUsers(params: {
  adAccountId: string;
  accessToken: string;
  bucketKey?: string;
}): Promise<AssignedUser[]> {
  const rows = await metaGetAllPages<{
    id: string;
    name: string;
    email?: string;
    tasks?: string[];
  }>(
    `${params.adAccountId}/assigned_users`,
    {
      fields: ["id", "name", "email", "tasks"],
      business: undefined,
      limit: 100,
    },
    { accessToken: params.accessToken, bucketKey: params.bucketKey },
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    tasks: r.tasks ?? [],
  }));
}

// Resolves a user identifier — accepts either a numeric Meta user id or an
// email — to the canonical FB user id. Falls back to scanning BM members
// by email when an email-like input is given.
export async function resolveUserIdFromEmail(params: {
  businessId: string;
  emailOrId: string;
  accessToken: string;
}): Promise<{ id: string; name?: string } | null> {
  const input = params.emailOrId.trim();
  if (/^\d{6,}$/u.test(input)) {
    // Looks like a Meta user id already.
    try {
      const u = await metaGet<{ id: string; name?: string }>(
        input,
        { fields: ["id", "name"] },
        { accessToken: params.accessToken },
      );
      return { id: u.id, name: u.name };
    } catch {
      return null;
    }
  }
  // Scan the BM's user list for a matching email — Meta's API doesn't expose
  // a direct email lookup, but BM-membership lists do include the email.
  const users = await listBusinessUsers({
    businessId: params.businessId,
    accessToken: params.accessToken,
  });
  const match = users.find(
    (u) => u.email && u.email.toLowerCase() === input.toLowerCase(),
  );
  if (!match) return null;
  return { id: match.id, name: match.name };
}

// Generic POST helper for write endpoints — used by assign + remove.
async function postForm(
  path: string,
  body: URLSearchParams,
  accessToken: string,
  method: "POST" | "DELETE" = "POST",
): Promise<unknown> {
  await acquire(`${accessToken.slice(0, 16)}:bm`);
  body.set("access_token", accessToken);
  const res = await fetch(`${BASE}/${API_VERSION}/${path}`, {
    method,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  if (!res.ok || (payload && (payload as MetaApiErrorPayload).error)) {
    const err = payload as MetaApiErrorPayload;
    throw new MetaApiError(
      err?.error ?? {
        message: text || res.statusText,
        type: "HttpError",
        code: res.status,
      },
    );
  }
  return payload;
}

// Assigns an existing BM user to one ad account with the given tasks. The
// user MUST already be a member of the same Business Manager that owns the
// ad account (Meta rejects otherwise — invite them via Business Manager UI
// or POST /<biz>/business_users first).
export async function assignUserToAdAccount(params: {
  adAccountId: string;
  userId: string;
  tasks: AdAccountTask[];
  accessToken: string;
}): Promise<void> {
  const body = new URLSearchParams({
    user: params.userId,
    tasks: params.tasks.join(","),
  });
  await postForm(
    `${params.adAccountId}/assigned_users`,
    body,
    params.accessToken,
  );
}

// Removes a user's assignment from an ad account. Doesn't touch their BM
// membership — they still belong to the BM, just no longer scoped to this
// ad account.
export async function removeUserFromAdAccount(params: {
  adAccountId: string;
  userId: string;
  accessToken: string;
}): Promise<void> {
  const body = new URLSearchParams({ user: params.userId });
  await postForm(
    `${params.adAccountId}/assigned_users`,
    body,
    params.accessToken,
    "DELETE",
  );
}
