import type { NextAuthConfig } from "next-auth";
import { ensureUserOnSignIn } from "@/server/access";

/** Shared by src/auth.ts and the tests. */
export const signInCallback: NonNullable<NextAuthConfig["callbacks"]>["signIn"] = async ({
  user,
  account,
  profile,
  email: emailCtx,
}) => {
  const email = user.email;
  if (account?.type === "email") {
    // Step 1 (link requested): always proceed so the response is identical for everyone; the
    // allowlist is enforced in the provider's sender and the adapter, which skip strangers.
    if (emailCtx?.verificationRequest) return true;
    // Step 2 (link used): the single-use token proves ownership; the allowlist still decides.
    if (!email) return "/not-invited";
    return (await ensureUserOnSignIn(email, null)) ? true : "/not-invited";
  }
  // Google: require a verified email (strictly true); a non-allowed account goes to /not-invited.
  if (!email || profile?.email_verified !== true) return "/not-invited";
  const sessionUser = await ensureUserOnSignIn(email, user.name ?? null);
  return sessionUser ? true : "/not-invited";
};
