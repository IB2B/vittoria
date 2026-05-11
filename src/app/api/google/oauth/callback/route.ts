import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { exchangeCodeForTokens } from "@/lib/google/oauth";
import { setPendingGoogleRefreshToken } from "@/lib/google/session";

const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "MANAGER") {
    return NextResponse.redirect(new URL("/login", APP_URL));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = req.cookies.get("vittoria_google_oauth_state")?.value;

  if (!code || !state || state !== expectedState) {
    const u = new URL("/clients/import?google_error=state_mismatch", APP_URL);
    u.searchParams.set("tab", "google");
    return NextResponse.redirect(u);
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (err) {
    const message = err instanceof Error ? err.message : "exchange_failed";
    const u = new URL("/clients/import", APP_URL);
    u.searchParams.set("google_error", message.slice(0, 200));
    return NextResponse.redirect(u);
  }

  if (!tokens.refresh_token) {
    const u = new URL("/clients/import", APP_URL);
    u.searchParams.set(
      "google_error",
      "no_refresh_token (revoke prior consent in Google Account → Connections, then retry)",
    );
    return NextResponse.redirect(u);
  }

  await setPendingGoogleRefreshToken(tokens.refresh_token);

  const res = NextResponse.redirect(new URL("/clients/import?tab=google", APP_URL));
  res.cookies.delete("vittoria_google_oauth_state");
  return res;
}
