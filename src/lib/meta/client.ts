import { acquire } from "./rate-limit";
import type { MetaApiError as MetaApiErrorPayload } from "./types";

const BASE = "https://graph.facebook.com";
const API_VERSION = process.env.META_API_VERSION ?? "v22.0";

const RETRYABLE_CODES = new Set([1, 2, 4, 17, 32, 613, 80004]);
const BACKOFF_MS = [2000, 4000, 8000];

export class MetaApiError extends Error {
  code: number;
  type: string;
  subcode?: number;

  constructor(payload: MetaApiErrorPayload["error"]) {
    super(payload.message);
    this.name = "MetaApiError";
    this.code = payload.code;
    this.type = payload.type;
    this.subcode = payload.error_subcode;
  }
}

export type MetaParams = Record<
  string,
  string | number | boolean | string[] | undefined
>;

function buildUrl(path: string, params: MetaParams = {}): string {
  const safePath = path.replace(/^\//, "");
  const url = new URL(`${BASE}/${API_VERSION}/${safePath}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      url.searchParams.set(key, value.join(","));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export type MetaRequestOptions = {
  accessToken: string;
  bucketKey?: string;
  signal?: AbortSignal;
};

export async function metaGet<T>(
  path: string,
  params: MetaParams,
  options: MetaRequestOptions,
): Promise<T> {
  const bucketKey = options.bucketKey ?? options.accessToken.slice(0, 16);
  let lastError: unknown;

  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    await acquire(bucketKey);
    try {
      const res = await fetch(
        buildUrl(path, { ...params, access_token: options.accessToken }),
        { signal: options.signal, cache: "no-store" },
      );
      const text = await res.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { raw: text };
      }

      if (!res.ok || (body && (body as MetaApiErrorPayload).error)) {
        const errBody = body as MetaApiErrorPayload;
        const apiError = new MetaApiError(
          errBody?.error ?? {
            message: text || res.statusText,
            type: "HttpError",
            code: res.status,
          },
        );
        if (
          attempt < BACKOFF_MS.length &&
          (RETRYABLE_CODES.has(apiError.code) || res.status >= 500)
        ) {
          lastError = apiError;
          await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
          continue;
        }
        throw apiError;
      }

      return body as T;
    } catch (err) {
      if (err instanceof MetaApiError) throw err;
      lastError = err;
      if (attempt < BACKOFF_MS.length) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("Meta request failed");
}

export async function metaGetAllPages<T>(
  path: string,
  params: MetaParams,
  options: MetaRequestOptions,
): Promise<T[]> {
  const all: T[] = [];
  let next: string | undefined;
  let safetyCounter = 0;

  do {
    const page = next
      ? await fetch(next, {
          signal: options.signal,
          cache: "no-store",
        }).then((r) => r.json() as Promise<{ data: T[]; paging?: { next?: string } }>)
      : await metaGet<{ data: T[]; paging?: { next?: string } }>(
          path,
          params,
          options,
        );
    all.push(...(page.data ?? []));
    next = page.paging?.next;
    safetyCounter += 1;
    if (safetyCounter > 50) break;
  } while (next);

  return all;
}

