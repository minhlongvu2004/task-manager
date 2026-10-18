import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { ensureUserOnSignIn } from "@/server/access";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, profile }) {
      const email = user.email;
      // Require a verified Google email (strictly true); a non-allowed account is sent to /not-invited.
      if (!email || profile?.email_verified !== true) return "/not-invited";
      const sessionUser = await ensureUserOnSignIn(email, user.name ?? null);
      return sessionUser ? true : "/not-invited";
    },
  },
});
