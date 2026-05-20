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

export type PendingBusinessUser = {
  id: string;
  email?: string;
  role?: string;
  status?: string;
  expirationTime?: string;
};

export type AssignedUser = {
  id: string;
  name: string;
  email?: string;
  tasks: string[];
};

// Resolves the REAL Meta Business Manager id that owns an ad account by
// asking Meta directly. Use this whenever the stored `AdAccount.businessId`
// might be synthetic (those that came from our Edit BM dialog start with
// `vittoria_bm_`) — Meta's BM-membership and assigned-users endpoints both
// reject anything that isn't a real BM id Meta knows about.
export async function getOwningBusinessId(params: {
  metaAccountId: string;
  accessToken: string;
}): Promise<{ id: string; name?: string } | null> {
  try {
    const r = await metaGet<{
      id: string;
      business?: { id: string; name?: string };
    }>(
      params.metaAccountId,
      { fields: ["id", "business"] },
      { accessToken: params.accessToken },
    );
    return r.business ? { id: r.business.id, name: r.business.name } : null;
  } catch {
    return null;
  }
}

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

// Lists BM invitations that have not yet been accepted. These can't be
// assigned to ad accounts yet (Meta refuses until they accept), but we
// show them so the user knows "oh, my friend hasn't accepted yet".
export async function listPendingBusinessUsers(params: {
  businessId: string;
  accessToken: string;
  bucketKey?: string;
}): Promise<PendingBusinessUser[]> {
  try {
    const rows = await metaGetAllPages<{
      id: string;
      email?: string;
      role?: string;
      status?: string;
      expiration_time?: string;
    }>(
      `${params.businessId}/pending_users`,
      {
        fields: ["id", "email", "role", "status", "expiration_time"],
        limit: 100,
      },
      { accessToken: params.accessToken, bucketKey: params.bucketKey },
    );
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      status: r.status,
      expirationTime: r.expiration_time,
    }));
  } catch {
    // Not every BM token exposes pending_users — degrade gracefully.
    return [];
  }
}

// Lists every user currently assigned to a specific ad account. Meta now
// requires `business=<bm-id>` on this endpoint, so we always pass it.
export async function listAdAccountAssignedUsers(params: {
  adAccountId: string;
  businessId: string;
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
      business: params.businessId,
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

// Result type for resolveUserIdFromEmail — distinguishes "found" from the
// two failure modes so the UI can show a useful message instead of just
// "not a member".
export type ResolveUserResult =
  | { kind: "ok"; id: string; name?: string }
  | { kind: "pending"; email: string } // invited but not yet accepted
  | { kind: "not_found"; knownEmails: string[] };

// Resolves a user identifier — accepts either a numeric Meta user id or an
// email — to the canonical FB user id. Falls back to scanning BM members
// by email when an email-like input is given.
export async function resolveUserIdFromEmail(params: {
  businessId: string;
  emailOrId: string;
  accessToken: string;
}): Promise<ResolveUserResult> {
  const input = params.emailOrId.trim();
  if (/^\d{6,}$/u.test(input)) {
    // Looks like a Meta user id already.
    try {
      const u = await metaGet<{ id: string; name?: string }>(
        input,
        { fields: ["id", "name"] },
        { accessToken: params.accessToken },
      );
      return { kind: "ok", id: u.id, name: u.name };
    } catch {
      return { kind: "not_found", knownEmails: [] };
    }
  }
  const needle = input.toLowerCase();
  const users = await listBusinessUsers({
    businessId: params.businessId,
    accessToken: params.accessToken,
  });
  const match = users.find(
    (u) => u.email && u.email.toLowerCase() === needle,
  );
  if (match) return { kind: "ok", id: match.id, name: match.name };

  // Not in confirmed members — maybe it's a pending invite that hasn't been
  // accepted yet. Surface that distinction so the user can chase the friend
  // to accept rather than getting a misleading "not a member" message.
  const pending = await listPendingBusinessUsers({
    businessId: params.businessId,
    accessToken: params.accessToken,
  });
  const stillPending = pending.find(
    (p) => p.email && p.email.toLowerCase() === needle,
  );
  if (stillPending && stillPending.email)
    return { kind: "pending", email: stillPending.email };

  return {
    kind: "not_found",
    knownEmails: users
      .map((u) => u.email)
      .filter((e): e is string => !!e),
  };
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
// ad account. `businessId` must be the REAL Meta BM id; resolve via
// `getOwningBusinessId` if you're unsure.
export async function assignUserToAdAccount(params: {
  adAccountId: string;
  businessId: string;
  userId: string;
  tasks: AdAccountTask[];
  accessToken: string;
}): Promise<void> {
  const body = new URLSearchParams({
    business: params.businessId,
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
  businessId: string;
  userId: string;
  accessToken: string;
}): Promise<void> {
  const body = new URLSearchParams({
    business: params.businessId,
    user: params.userId,
  });
  await postForm(
    `${params.adAccountId}/assigned_users`,
    body,
    params.accessToken,
    "DELETE",
  );
}
