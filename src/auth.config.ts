import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const PUBLIC_PATHS = ["/signin", "/not-invited"];

/** Edge-safe config (no DB imports); shared by src/auth.ts and src/proxy.ts. */
export const authConfig = {
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/not-invited" },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/api/auth")) return true;
      if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
