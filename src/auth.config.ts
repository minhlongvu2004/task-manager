import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/** Safe only because the signIn callback requires email_verified and the allowlist; see auth-adapter.ts. */
export const GOOGLE_OPTIONS = { allowDangerousEmailAccountLinking: true };

const PUBLIC_PATHS = ["/signin", "/not-invited"];

/** Edge-safe config (no DB imports); shared by src/auth.ts and src/proxy.ts. */
export const authConfig = {
  providers: [Google(GOOGLE_OPTIONS)],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/signin", error: "/not-invited", verifyRequest: "/verify-request" },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/api/auth")) return true;
      // Healthcheck, and the cron route (which checks its own CRON_SECRET bearer token).
      if (pathname === "/api/health" || pathname === "/api/cron/purge") return true;
      if (pathname === "/verify-request") return true; // exact path only
      // Exact matches: the sign-in server actions post to /signin itself.
      if (PUBLIC_PATHS.includes(pathname)) return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
