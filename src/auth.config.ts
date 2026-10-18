import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const PUBLIC_PATHS = ["/signin", "/not-invited"];

/** Edge-safe config (no DB imports); shared by src/auth.ts and src/proxy.ts. */
export const authConfig = {
  providers: [Google],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/signin", error: "/not-invited" },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/api/auth")) return true;
      // Healthcheck, and the cron route (which checks its own CRON_SECRET bearer token).
      if (pathname === "/api/health" || pathname === "/api/cron/purge") return true;
      if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
