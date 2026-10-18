import { and, eq } from "drizzle-orm";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { getDb } from "@/db/client";
import { users, verificationTokens } from "@/db/schema";
import { ensureUserOnSignIn, isEmailAllowed, normalizeEmail } from "./access";

/*
 * A minimal Auth.js adapter used ONLY by the email sign-in flow (sessions stay JWT). We do not use
 * @auth/drizzle-adapter: it is not installed, expects users.emailVerified/image plus accounts and
 * sessions tables, and its createUser would insert users without the allowlist check. Here every
 * user write goes through ensureUserOnSignIn, so a non-allowed address never gets a users row.
 */
const toAdapterUser = (u: { id: string; email: string; name: string | null }): AdapterUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  emailVerified: null,
});

/*
 * The adapter is attached to the whole Auth.js instance, so the Google (OAuth) path calls it too.
 * Google must keep working unchanged: getUserByAccount returns null (we store no provider
 * accounts), linkAccount is a no-op, and Google is configured with allowDangerousEmailAccountLinking
 * so handleLoginOrRegister reuses the users row by email instead of throwing OAuthAccountNotLinked.
 * That is safe because the signIn callback runs first and already requires email_verified === true
 * and the allowlist, and ensureUserOnSignIn has created/reused the row keyed by that email.
 * Emails are normalized with normalizeEmail (trim + lowercase); Auth.js's own normalizer also does
 * NFKC and rejects malformed addresses before they reach us, so the two agree for valid input.
 */
export const authAdapter: Adapter = {
  async getUserByAccount() {
    return null;
  },
  async linkAccount() {},
  async createVerificationToken(t) {
    // Strangers get the same screen but no stored token (and no email is sent).
    if (!(await isEmailAllowed(t.identifier))) return t;
    const db = await getDb();
    await db.insert(verificationTokens).values({ ...t, identifier: normalizeEmail(t.identifier) });
    return t;
  },
  async useVerificationToken({ identifier, token }) {
    const db = await getDb();
    // Delete-and-return in one statement: a token can be used at most once.
    const [row] = await db
      .delete(verificationTokens)
      .where(and(eq(verificationTokens.identifier, normalizeEmail(identifier)), eq(verificationTokens.token, token)))
      .returning();
    return row ?? null;
  },
  async getUserByEmail(email) {
    const db = await getDb();
    const [u] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
    return u ? toAdapterUser(u) : null;
  },
  async getUser(id) {
    const db = await getDb();
    const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return u ? toAdapterUser(u) : null;
  },
  async createUser(user) {
    const u = await ensureUserOnSignIn(user.email, user.name ?? null);
    if (!u) throw new Error("Email is not allowed");
    return toAdapterUser({ id: u.id, email: u.email, name: user.name ?? null });
  },
  async updateUser(user) {
    // Nothing to update (no emailVerified column); return the stored row.
    const db = await getDb();
    const [u] = await db.select().from(users).where(eq(users.id, user.id as string)).limit(1);
    if (!u) throw new Error("User not found");
    return toAdapterUser(u);
  },
};
