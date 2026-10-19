import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { allowedEmails } from "@/db/schema";
import { normalizeEmail, type SessionUser } from "./access";
import { BlockedError } from "./errors";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertOwner(user: SessionUser): void {
  if (!user.isWorkspaceOwner) throw new BlockedError("Only the owner can manage who is invited");
}

/** The invited list: everyone allowed to sign in, apart from the owner (who always can). Owner only. */
export async function listInvited(user: SessionUser): Promise<string[]> {
  assertOwner(user);
  const db = await getDb();
  const rows = await db.select({ email: allowedEmails.email }).from(allowedEmails).orderBy(asc(allowedEmails.email));
  return rows.map((r) => r.email);
}

/** Lets an email address sign in. Gives no access to any team. Owner only; returns the cleaned address. */
export async function inviteEmail(user: SessionUser, rawEmail: string): Promise<string> {
  assertOwner(user);
  const email = normalizeEmail(rawEmail ?? "");
  if (!EMAIL.test(email)) throw new BlockedError("Enter a valid email address");
  const owner = process.env.OWNER_EMAIL ? normalizeEmail(process.env.OWNER_EMAIL) : null;
  if (email === owner) return email; // the owner can always sign in
  const db = await getDb();
  await db.insert(allowedEmails).values({ email }).onConflictDoNothing();
  return email;
}

/**
 * Stops an address signing in (a live session ends too: getSessionUser re-checks the list). Their
 * account, team memberships and tasks stay, so shared history is not lost. Owner only.
 */
export async function removeInvite(user: SessionUser, rawEmail: string): Promise<void> {
  assertOwner(user);
  const db = await getDb();
  await db.delete(allowedEmails).where(eq(allowedEmails.email, normalizeEmail(rawEmail ?? "")));
}
