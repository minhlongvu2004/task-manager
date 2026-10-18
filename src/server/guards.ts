import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { projects, tasks } from "@/db/schema";
import { assertCanSeeTeam, type SessionUser } from "./access";
import { BlockedError, NotFoundError } from "./errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** Throws BlockedError unless `value` is null or a real calendar date written YYYY-MM-DD. */
export function checkDueDate(value: string | null): string | null {
  if (value === null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) return value;
  }
  throw new BlockedError("Due date must be a valid date (YYYY-MM-DD)");
}

/** Trims and checks a required text field. */
export function checkName(raw: string, label: string, max = 200): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v === "") throw new BlockedError(`${label} is required`);
  if (Array.from(v).length > max) throw new BlockedError(`${label} must be ${max} characters or fewer`);
  return v;
}

/**
 * Team access gate for a team id: invalid or unknown ids and invisible teams all give the same
 * NotFoundError. Every read or write of team data goes through this or the two helpers below.
 */
export async function authorizeTeam(user: SessionUser, teamId: string): Promise<void> {
  if (!isUuid(teamId)) throw new NotFoundError("Team not found");
  await assertCanSeeTeam(user, teamId);
}

/** Resolves a project's team, asserts access, and returns the project row. */
export async function authorizeProject(user: SessionUser, projectId: string) {
  if (!isUuid(projectId)) throw new NotFoundError("Project not found");
  const db = await getDb();
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!row) throw new NotFoundError("Project not found");
  try {
    await assertCanSeeTeam(user, row.teamId);
  } catch {
    throw new NotFoundError("Project not found");
  }
  return row;
}

/** Resolves a task's team (task -> project -> team), asserts access, returns the task row. */
export async function authorizeTask(user: SessionUser, taskId: string) {
  if (!isUuid(taskId)) throw new NotFoundError("Task not found");
  const db = await getDb();
  const [row] = await db
    .select({ task: tasks, teamId: projects.teamId })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.id, taskId))
    .limit(1);
  if (!row) throw new NotFoundError("Task not found");
  try {
    await assertCanSeeTeam(user, row.teamId);
  } catch {
    throw new NotFoundError("Task not found");
  }
  return { task: row.task, teamId: row.teamId };
}
