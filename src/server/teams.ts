import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { allowedEmails, projects, tasks, teamMembers, teams, users, workspaces } from "@/db/schema";
import { isEmailAllowed, normalizeEmail, visibleTeamIds, type SessionUser } from "./access";
import { BlockedError } from "./errors";
import { authorizeTeam, checkName, isUuid } from "./guards";

export type Member = { id: string; email: string; name: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listTeams(user: SessionUser) {
  const ids = await visibleTeamIds(user);
  if (ids.length === 0) return [];
  const db = await getDb();
  return db.select().from(teams).where(inArray(teams.id, ids)).orderBy(asc(teams.name));
}

export async function createTeam(user: SessionUser, input: { name: string; color: string }) {
  const name = checkName(input.name, "Team name");
  const color = checkName(input.color, "Color", 50);
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Version 1 has a single workspace; every team is created in it.
    const [ws] = await tx.select({ id: workspaces.id }).from(workspaces).limit(1);
    if (!ws) throw new BlockedError("No workspace exists yet");
    const [team] = await tx.insert(teams).values({ workspaceId: ws.id, name, color }).returning();
    await tx.insert(teamMembers).values({ teamId: team.id, userId: user.id });
    return team;
  });
}

export async function listTeamMembers(user: SessionUser, teamId: string): Promise<Member[]> {
  await authorizeTeam(user, teamId);
  const db = await getDb();
  return db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(users.email));
}

export async function addMemberByEmail(user: SessionUser, teamId: string, rawEmail: string): Promise<Member> {
  await authorizeTeam(user, teamId);
  const email = normalizeEmail(rawEmail ?? "");
  if (!EMAIL.test(email)) throw new BlockedError("Enter a valid email address");
  // Only the workspace owner may invite a brand-new email; members can add people already allowed.
  if (!user.isWorkspaceOwner && !(await isEmailAllowed(email))) {
    throw new BlockedError("Ask the workspace owner to invite them first");
  }
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.insert(allowedEmails).values({ email }).onConflictDoNothing();
    await tx.insert(users).values({ email }).onConflictDoNothing();
    const [u] = await tx.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.email, email));
    await tx.insert(teamMembers).values({ teamId, userId: u.id }).onConflictDoNothing();
    return u;
  });
}

export async function removeMember(user: SessionUser, teamId: string, userId: string): Promise<void> {
  await authorizeTeam(user, teamId);
  if (!isUuid(userId)) return; // cannot be a member
  const db = await getDb();
  await db.transaction(async (tx) => {
    // Lock the member row so a concurrent createTask/updateTask (which share-locks it) cannot
    // give this member a doing/pending task after the count below.
    await tx
      .select({ id: teamMembers.userId })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .for("update");
    const teamProjects = tx.select({ id: projects.id }).from(projects).where(eq(projects.teamId, teamId));
    const [{ n }] = await tx
      .select({ n: count() })
      .from(tasks)
      .where(
        and(
          inArray(tasks.projectId, teamProjects),
          eq(tasks.ownerId, userId),
          inArray(tasks.status, ["doing", "pending"]),
          isNull(tasks.deletedAt),
        ),
      );
    if (n > 0) throw new BlockedError(`Reassign ${n} tasks first`);
    // Assigned tasks (including soft-deleted ones, so a later restore stays consistent) go back
    // to unassigned. Soft-deleted doing/pending tasks and all succeeded tasks keep their owner.
    await tx
      .update(tasks)
      .set({ status: "unassigned", ownerId: null })
      .where(and(inArray(tasks.projectId, teamProjects), eq(tasks.ownerId, userId), eq(tasks.status, "assigned")));
    await tx.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  });
}

export async function deleteTeam(user: SessionUser, teamId: string): Promise<void> {
  await authorizeTeam(user, teamId);
  const db = await getDb();
  await db.transaction(async (tx) => {
    // Exclusive team lock: createProject share-locks the same row, so no project can slip in.
    await tx.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).for("update");
    const [{ n }] = await tx.select({ n: count() }).from(projects).where(eq(projects.teamId, teamId));
    if (n > 0) throw new BlockedError("Delete or move this team's projects first");
    await tx.delete(teams).where(eq(teams.id, teamId));
  });
}
