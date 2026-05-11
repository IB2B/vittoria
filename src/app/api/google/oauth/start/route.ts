import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { auth } from "@/auth";
import { buildAuthorizationUrl } from "@/lib/google/oauth";
import { hasGoogleAdsCredentials } from "@/lib/google/config";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "MANAGER") {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL ?? "http://localhost:3001"));
  }
  if (!hasGoogleAdsCredentials()) {
    return NextResponse.redirect(
      new URL("/clients/import", process.env.NEXTAUTH_URL ?? "http://localhost:3001"),
    );
  }
  const state = randomBytes(16).toString("hex");
  const url = buildAuthorizationUrl(state);
  const res = NextResponse.redirect(url);
  res.cookies.set("vittoria_google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });
  return res;
}
