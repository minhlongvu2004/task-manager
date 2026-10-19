import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { allowedEmails, teamMembers, users, workspaces } from "@/db/schema";
import { NotFoundError } from "./errors";

export type SessionUser = { id: string; email: string; isWorkspaceOwner: boolean };

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

function ownerEmail(): string | null {
  const e = process.env.OWNER_EMAIL;
  return e ? normalizeEmail(e) || null : null;
}

/** True when the email is OWNER_EMAIL or on the allowlist (case-insensitive). */
export async function isEmailAllowed(email: string): Promise<boolean> {
  const e = normalizeEmail(email);
  if (!e) return false;
  if (e === ownerEmail()) return true;
  const db = await getDb();
  const rows = await db.select().from(allowedEmails).where(eq(allowedEmails.email, e)).limit(1);
  return rows.length > 0;
}

/**
 * Called on every sign-in. Returns null (and creates nothing) for a non-allowed email. Otherwise
 * finds or creates the user (reusing a row made earlier, e.g. by addMemberByEmail, and filling in
 * the name); the owner's first sign-in also creates the workspace. Idempotent and serialized with
 * an advisory lock so double calls cannot create duplicates.
 */
export async function ensureUserOnSignIn(
  email: string,
  name: string | null,
): Promise<SessionUser | null> {
  const e = normalizeEmail(email);
  if (!(await isEmailAllowed(e))) return null;
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4001)`);
    const [user] = await tx
      .insert(users)
      .values({ email: e, name })
      .onConflictDoUpdate({
        target: users.email,
        set: { name: sql`coalesce(${users.name}, excluded.name)` },
      })
      .returning();
    let [ws] = await tx.select().from(workspaces).where(eq(workspaces.ownerUserId, user.id)).limit(1);
    if (!ws && e === ownerEmail()) {
      const existing = await tx.select({ id: workspaces.id }).from(workspaces).limit(1);
      if (existing.length === 0) {
        [ws] = await tx
          .insert(workspaces)
          .values({ name: "My workspace", ownerUserId: user.id })
          .returning();
      }
    }
    return { id: user.id, email: user.email, isWorkspaceOwner: Boolean(ws) };
  });
}

/** Resolves the signed-in user from the Auth.js session via the DB; null when signed out. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { auth } = await import("@/auth"); // lazy: keeps next-auth out of unit tests
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  if (!user) return null;
  // Re-check on every request so removing someone from the allowlist revokes a live session.
  if (!(await isEmailAllowed(user.email))) return null;
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.ownerUserId, user.id)).limit(1);
  return { id: user.id, email: user.email, isWorkspaceOwner: Boolean(ws) };
}

/** Teams the user is a member of. Teams are private: the owner has no special view into other people's teams. */
export async function visibleTeamIds(user: SessionUser): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select({ id: teamMembers.teamId }).from(teamMembers).where(eq(teamMembers.userId, user.id));
  return rows.map((r) => r.id);
}

/** Throws NotFoundError (not a "forbidden") when the user is not a member of the team. */
export async function assertCanSeeTeam(user: SessionUser, teamId: string): Promise<void> {
  const db = await getDb();
  const rows = await db
    .select({ id: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)));
  if (rows.length === 0) throw new NotFoundError("Team not found");
}
