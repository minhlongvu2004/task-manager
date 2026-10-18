import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { PRIORITIES, projects } from "@/db/schema";
import { sortProjects, type Priority } from "@/lib/domain/project-view";
import { visibleTeamIds, type SessionUser } from "./access";
import { BlockedError } from "./errors";
import { authorizeProject, authorizeTeam, checkDueDate, checkName } from "./guards";

function checkPriority(p: unknown): Priority {
  if (!(PRIORITIES as readonly unknown[]).includes(p)) throw new BlockedError("Invalid priority");
  return p as Priority;
}

export async function listProjects(user: SessionUser, opts: { includeArchived?: boolean } = {}) {
  const ids = await visibleTeamIds(user);
  if (ids.length === 0) return [];
  const db = await getDb();
  const where = opts.includeArchived
    ? inArray(projects.teamId, ids)
    : and(inArray(projects.teamId, ids), eq(projects.state, "active"));
  return sortProjects(await db.select().from(projects).where(where));
}

export async function getProject(user: SessionUser, projectId: string) {
  return authorizeProject(user, projectId);
}

export async function createProject(
  user: SessionUser,
  input: { teamId: string; name: string; priority: Priority; dueDate: string | null },
) {
  await authorizeTeam(user, input.teamId);
  const name = checkName(input.name, "Project name");
  const priority = checkPriority(input.priority);
  const dueDate = checkDueDate(input.dueDate ?? null);
  const db = await getDb();
  const [row] = await db.insert(projects).values({ teamId: input.teamId, name, priority, dueDate }).returning();
  return row;
}

export async function updateProject(
  user: SessionUser,
  projectId: string,
  patch: { name?: string; priority?: Priority; dueDate?: string | null },
) {
  const current = await authorizeProject(user, projectId);
  const set: Partial<typeof projects.$inferInsert> = {};
  if (patch.name !== undefined) set.name = checkName(patch.name, "Project name");
  if (patch.priority !== undefined) set.priority = checkPriority(patch.priority);
  if (patch.dueDate !== undefined) set.dueDate = checkDueDate(patch.dueDate);
  if (Object.keys(set).length === 0) return current;
  const db = await getDb();
  const [row] = await db.update(projects).set(set).where(eq(projects.id, projectId)).returning();
  return row;
}

export async function setProjectArchived(user: SessionUser, projectId: string, archived: boolean) {
  await authorizeProject(user, projectId);
  const db = await getDb();
  const [row] = await db
    .update(projects)
    .set({ state: archived ? "archived" : "active" })
    .where(eq(projects.id, projectId))
    .returning();
  return row;
}
