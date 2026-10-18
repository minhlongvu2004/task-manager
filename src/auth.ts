import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { signInCallback } from "@/server/auth-callbacks";
import { authAdapter } from "@/server/auth-adapter";
import { emailProvider } from "@/server/email-auth";

const resendKey = process.env.AUTH_RESEND_KEY;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Email links are enabled only when a Resend key is configured. The adapter only stores
  // verification tokens; sessions stay JWT.
  ...(resendKey
    ? {
        adapter: authAdapter,
        providers: [
          ...authConfig.providers,
          emailProvider({ apiKey: resendKey, from: process.env.EMAIL_FROM || "login@minhlongvu.com" }),
        ],
      }
    : {}),
  callbacks: { ...authConfig.callbacks, signIn: signInCallback },
});
