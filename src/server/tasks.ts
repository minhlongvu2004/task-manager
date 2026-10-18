import { and, desc, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { tasks, teamMembers } from "@/db/schema";
import { STATUS_ORDER, type TaskStatus } from "@/lib/domain/status";
import { countsByStatus, sortTasks } from "@/lib/domain/project-view";
import { newTaskState, setOwner, setStatus, validateTitle, type RuleResult, type TaskState } from "@/lib/domain/task-rules";
import type { SessionUser } from "./access";
import { BlockedError, NotFoundError } from "./errors";
import { authorizeProject, authorizeTask, checkDueDate, isUuid } from "./guards";

const TRASH_DAYS = 30;
type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

function rule(r: RuleResult): TaskState {
  if (!r.ok) throw new BlockedError(r.error);
  return r.state;
}

function title(raw: string): string {
  const r = validateTitle(raw);
  if (!r.ok) throw new BlockedError(r.error);
  return r.title;
}

async function assertTeamMember(tx: Tx, teamId: string, userId: string) {
  if (!isUuid(userId)) throw new BlockedError("Owner must be a member of the team");
  const rows = await tx
    .select({ id: teamMembers.userId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .for("share"); // held until the surrounding write commits, so removeMember cannot interleave
  if (rows.length === 0) throw new BlockedError("Owner must be a member of the team");
}

export async function listTasks(user: SessionUser, projectId: string, status: TaskStatus) {
  await authorizeProject(user, projectId);
  const db = await getDb();
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.status, status), isNull(tasks.deletedAt)));
  return sortTasks(rows.map((row) => ({ dueDate: row.dueDate, createdAt: row.createdAt.toISOString(), row }))).map(
    (x) => x.row,
  );
}

export async function taskCounts(user: SessionUser, projectId: string) {
  await authorizeProject(user, projectId);
  const db = await getDb();
  const rows = await db
    .select({ status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)));
  return countsByStatus(rows);
}

export async function listTrash(user: SessionUser, projectId: string) {
  await authorizeProject(user, projectId);
  const db = await getDb();
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNotNull(tasks.deletedAt)))
    .orderBy(desc(tasks.deletedAt));
}

export async function createTask(
  user: SessionUser,
  projectId: string,
  input: { title: string; ownerId: string | null; dueDate: string | null },
) {
  const project = await authorizeProject(user, projectId);
  const t = title(input.title);
  const dueDate = checkDueDate(input.dueDate ?? null);
  const ownerId = input.ownerId ?? null;
  const db = await getDb();
  return db.transaction(async (tx) => {
    if (ownerId !== null) await assertTeamMember(tx, project.teamId, ownerId);
    const state = newTaskState(ownerId);
    const [row] = await tx
      .insert(tasks)
      .values({ projectId, title: t, dueDate, status: state.status, ownerId: state.ownerId, stuckReason: state.stuckReason })
      .returning();
    return row;
  });
}

export async function updateTask(
  user: SessionUser,
  taskId: string,
  patch: { title?: string; ownerId?: string | null; status?: TaskStatus; dueDate?: string | null; stuckReason?: string },
) {
  const { teamId } = await authorizeTask(user, taskId);
  const newTitle = patch.title !== undefined ? title(patch.title) : undefined;
  const newDue = patch.dueDate !== undefined ? checkDueDate(patch.dueDate) : undefined;
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Lock the row so concurrent edits serialize and the rules see the latest state.
    const [cur] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).for("update");
    if (!cur || cur.deletedAt !== null) throw new NotFoundError("Task not found");
    if (patch.status !== undefined && !STATUS_ORDER.includes(patch.status)) throw new BlockedError("Invalid status");

    let state: TaskState = { status: cur.status, ownerId: cur.ownerId, stuckReason: cur.stuckReason };
    if (patch.ownerId !== undefined) {
      if (patch.ownerId !== null && patch.ownerId !== cur.ownerId) await assertTeamMember(tx, teamId, patch.ownerId);
      state = rule(setOwner(state, patch.ownerId));
    }
    if (patch.status !== undefined && patch.status !== state.status) {
      state = rule(setStatus(state, patch.status, { stuckReason: patch.stuckReason }));
    } else if (state.status === "pending" && patch.stuckReason !== undefined) {
      // setStatus(.., "pending") always demands a reason, so a reason-only edit is handled here.
      const reason = patch.stuckReason.trim();
      if (reason === "") throw new BlockedError("A pending task needs a reason it is stuck");
      state = { ...state, stuckReason: reason };
    }

    // A task from Assigned onward (except Succeeded) needs a current member as owner, even when the
    // owner is unchanged (e.g. reopening a Succeeded task whose owner has left). An unchanged owner on a
    // Succeeded/Unassigned result skips the lock, which avoids a deadlock with removeMember.
    const ownerUnchanged = state.ownerId === cur.ownerId;
    if (state.ownerId !== null && ownerUnchanged && state.status !== "succeeded" && state.status !== "unassigned") {
      await assertTeamMember(tx, teamId, state.ownerId);
    }

    const [row] = await tx
      .update(tasks)
      .set({
        status: state.status,
        ownerId: state.ownerId,
        stuckReason: state.stuckReason,
        ...(newTitle !== undefined && { title: newTitle }),
        ...(newDue !== undefined && { dueDate: newDue }),
      })
      .where(eq(tasks.id, taskId))
      .returning();
    return row;
  });
}

export async function deleteTask(user: SessionUser, taskId: string): Promise<void> {
  await authorizeTask(user, taskId);
  const db = await getDb();
  const rows = await db
    .update(tasks)
    .set({ deletedAt: new Date() })
    .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
    .returning({ id: tasks.id });
  if (rows.length === 0) throw new NotFoundError("Task not found");
}

export async function restoreTask(user: SessionUser, taskId: string) {
  const { teamId } = await authorizeTask(user, taskId);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(tasks)
      .set({ deletedAt: null })
      .where(and(eq(tasks.id, taskId), isNotNull(tasks.deletedAt)))
      .returning();
    if (!row) throw new NotFoundError("Task not found");
    // A doing/pending task whose owner left the team meanwhile can't stay owned: back to unassigned.
    // Assigned tasks were already reset by removeMember; succeeded tasks keep their owner.
    if (row.ownerId !== null && (row.status === "doing" || row.status === "pending")) {
      const member = await tx
        .select({ id: teamMembers.userId })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, row.ownerId)));
      if (member.length === 0) {
        const [reset] = await tx
          .update(tasks)
          .set({ status: "unassigned", ownerId: null, stuckReason: null })
          .where(eq(tasks.id, taskId))
          .returning();
        return reset;
      }
    }
    return row;
  });
}

/** Not user-scoped: called by the cron job. Permanently removes tasks deleted over 30 days before `now`. */
export async function purgeTrash(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_DAYS * 86_400_000);
  const db = await getDb();
  const rows = await db.delete(tasks).where(and(isNotNull(tasks.deletedAt), lt(tasks.deletedAt, cutoff))).returning({ id: tasks.id });
  return rows.length;
}
