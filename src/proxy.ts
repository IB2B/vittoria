// Per Next 16 the conventional name is `proxy.ts` instead of `middleware.ts`.
// Re-exported under both names so we work on Next 15 + 16 without churn.
export { auth as middleware, auth as proxy } from "@/auth";

// Auth gate excludes:
//  - api/auth (NextAuth's own routes)
//  - _next static + image optimizer
//  - any file with a static-asset extension (svg/png/jpg/...)
//  - icon / apple-icon / opengraph-image (Next 16 metadata routes — must be
//    crawlable by Slack/iOS/social platforms without a session)
//  - favicon.ico (legacy fallback)
export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|icon|apple-icon|opengraph-image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
