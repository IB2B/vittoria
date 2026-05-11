import { cookies } from "next/headers";

import { encryptToken, decryptToken } from "@/lib/crypto";

const COOKIE_NAME = "vittoria_google_oauth";
const TTL_SECONDS = 15 * 60;

export async function setPendingGoogleRefreshToken(
  refreshToken: string,
): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, encryptToken(refreshToken), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function getPendingGoogleRefreshToken(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return decryptToken(raw);
  } catch {
    return null;
  }
}

export async function clearPendingGoogleRefreshToken(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
