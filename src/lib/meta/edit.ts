// Write operations against Meta's Marketing API. The token must have
// `ads_management` scope (read-only tokens with `ads_read` will get rejected
// with code 200 / OAuthException).

import { acquire } from "./rate-limit";
import { MetaApiError } from "./client";
import type { MetaApiError as MetaApiErrorPayload } from "./types";

const BASE = "https://graph.facebook.com";
const API_VERSION = process.env.META_API_VERSION ?? "v22.0";

export type CampaignStatus = "ACTIVE" | "PAUSED";

export async function setCampaignStatus({
  campaignId,
  accessToken,
  status,
  bucketKey,
}: {
  campaignId: string;
  accessToken: string;
  status: CampaignStatus;
  bucketKey?: string;
}): Promise<{ success: true }> {
  await acquire(bucketKey ?? accessToken.slice(0, 16));

  const url = new URL(`${BASE}/${API_VERSION}/${campaignId}`);
  const body = new URLSearchParams({
    status,
    access_token: accessToken,
  });

  const res = await fetch(url.toString(), {
    method: "POST",
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

  return { success: true };
}
