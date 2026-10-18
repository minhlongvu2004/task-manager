"use server";

import { revalidatePath } from "next/cache";
import { STATUS_ORDER, type TaskStatus } from "@/lib/domain/status";
import { getSessionUser, type SessionUser } from "@/server/access";
import { BlockedError, NotFoundError } from "@/server/errors";
import { createTask, deleteTask, restoreTask, updateTask } from "@/server/tasks";

export type ActionResult = { ok: true } | { ok: false; error: string };

const bad = (error: string): ActionResult => ({ ok: false, error });

// The acting user always comes from the session; nothing the client sends is trusted as identity.
async function run(fn: (user: SessionUser) => Promise<unknown>): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return bad("Not signed in");
  try {
    await fn(user);
  } catch (e) {
    if (e instanceof NotFoundError) return bad("Not found");
    if (e instanceof BlockedError) return bad(e.message);
    throw e; // unexpected: let Next log it without leaking details to the client
  }
  // Counts on the project list and the task lists both change.
  revalidatePath("/");
  revalidatePath("/projects/[id]", "page");
  revalidatePath("/projects/[id]/trash", "page");
  return { ok: true };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** string | null | undefined only; anything else is rejected. */
function optText(v: unknown, field: string): string | null | undefined {
  if (v === undefined || v === null) return v;
  if (typeof v === "string") return v;
  throw new BlockedError(`${field} must be text`);
}

function status(v: unknown): TaskStatus | undefined {
  if (v === undefined) return undefined;
  const s = STATUS_ORDER.find((x) => x === v);
  if (!s) throw new BlockedError("Invalid status");
  return s;
}

function idArg(v: unknown): string {
  if (typeof v !== "string") throw new NotFoundError();
  return v;
}

export async function createTaskAction(projectId: unknown, input: unknown): Promise<ActionResult> {
  return run(async (user) => {
    if (!isObj(input)) throw new BlockedError("Invalid task");
    const title = optText(input.title, "Title");
    await createTask(user, idArg(projectId), {
      title: title ?? "",
      ownerId: optText(input.ownerId, "Owner") ?? null,
      dueDate: optText(input.dueDate, "Due date") || null,
    });
  });
}

export async function updateTaskAction(taskId: unknown, patch: unknown): Promise<ActionResult> {
  return run(async (user) => {
    if (!isObj(patch)) throw new BlockedError("Invalid task");
    const out: Parameters<typeof updateTask>[2] = {};
    const title = optText(patch.title, "Title");
    if (title !== undefined) out.title = title ?? "";
    const ownerId = optText(patch.ownerId, "Owner");
    if (ownerId !== undefined) out.ownerId = ownerId || null;
    const st = status(patch.status);
    if (st !== undefined) out.status = st;
    const due = optText(patch.dueDate, "Due date");
    if (due !== undefined) out.dueDate = due || null;
    const reason = optText(patch.stuckReason, "Reason");
    if (reason !== undefined && reason !== null) out.stuckReason = reason;
    await updateTask(user, idArg(taskId), out);
  });
}

export async function deleteTaskAction(taskId: unknown): Promise<ActionResult> {
  return run((user) => deleteTask(user, idArg(taskId)));
}

export async function restoreTaskAction(taskId: unknown): Promise<ActionResult> {
  return run((user) => restoreTask(user, idArg(taskId)));
}
