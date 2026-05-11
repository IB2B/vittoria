import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";

import { prisma } from "@/lib/db";
import { isLockedOut, recordAttempt } from "@/lib/login-attempts";

const credentialsSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Vercel preview URLs change per deploy — trustHost lets Auth.js auto-detect
  // the host from request headers instead of demanding a fixed NEXTAUTH_URL.
  // For prod we still set NEXTAUTH_URL on the production env.
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        if (await isLockedOut(email)) {
          await recordAttempt(email, false);
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          await recordAttempt(email, false);
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await recordAttempt(email, false, user.id);
          return null;
        }

        await Promise.all([
          recordAttempt(email, true, user.id),
          prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          }),
        ]);

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          role: user.role,
          clientId: user.clientId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.clientId = (user as { clientId: string | null }).clientId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as Role;
        session.user.clientId = (token.clientId as string | null) ?? null;
      }
      return session;
    },
    authorized({ auth: session, request: { nextUrl } }) {
      const path = nextUrl.pathname;
      const isAuthRoute =
        path.startsWith("/login") ||
        path.startsWith("/forgot") ||
        path.startsWith("/reset");
      if (isAuthRoute) return true;
      return !!session;
    },
  },
});
