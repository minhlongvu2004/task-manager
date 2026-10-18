"use server";

import { revalidatePath } from "next/cache";
import type { Priority } from "@/lib/domain/project-view";
import { getSessionUser, type SessionUser } from "@/server/access";
import { BlockedError, NotFoundError } from "@/server/errors";
import { createProject, setProjectArchived, updateProject } from "@/server/projects";
import { addMemberByEmail, createTeam, deleteTeam, removeMember } from "@/server/teams";

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const bad = (error: string): { ok: false; error: string } => ({ ok: false, error });

// The acting user always comes from the session; nothing the client sends is trusted as identity.
async function run<T extends object = object>(fn: (user: SessionUser) => Promise<T | void>): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return bad("Not signed in");
  let extra: T | void;
  try {
    extra = await fn(user);
  } catch (e) {
    if (e instanceof NotFoundError) return bad("Not found");
    if (e instanceof BlockedError) return bad(e.message);
    throw e; // unexpected: let Next log it without leaking details to the client
  }
  revalidatePath("/");
  revalidatePath("/projects/[id]", "page");
  return { ok: true, ...(extra ?? {}) } as ActionResult<T>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function text(v: unknown, field: string): string {
  if (typeof v === "string") return v;
  throw new BlockedError(`${field} must be text`);
}

/** string | null | undefined only; anything else is rejected. */
function optText(v: unknown, field: string): string | null | undefined {
  if (v === undefined || v === null) return v;
  return text(v, field);
}

function idArg(v: unknown): string {
  if (typeof v !== "string") throw new NotFoundError();
  return v;
}

export async function createTeamAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async (user) => {
    if (!isObj(input)) throw new BlockedError("Invalid team");
    const team = await createTeam(user, { name: text(input.name, "Team name"), color: text(input.color, "Color") });
    return { id: team.id };
  });
}

export async function addMemberAction(
  teamId: unknown,
  email: unknown,
): Promise<ActionResult<{ member: { id: string; email: string; name: string | null } }>> {
  return run(async (user) => {
    const m = await addMemberByEmail(user, idArg(teamId), text(email, "Email"));
    return { member: { id: m.id, email: m.email, name: m.name } };
  });
}

export async function removeMemberAction(teamId: unknown, userId: unknown): Promise<ActionResult> {
  return run((user) => removeMember(user, idArg(teamId), idArg(userId)));
}

export async function deleteTeamAction(teamId: unknown): Promise<ActionResult> {
  return run((user) => deleteTeam(user, idArg(teamId)));
}

export async function createProjectAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async (user) => {
    if (!isObj(input)) throw new BlockedError("Invalid project");
    const p = await createProject(user, {
      teamId: idArg(input.teamId),
      name: text(input.name, "Project name"),
      priority: text(input.priority, "Priority") as Priority, // validated by the data layer
      dueDate: optText(input.dueDate, "Due date") || null,
    });
    return { id: p.id };
  });
}

export async function updateProjectAction(projectId: unknown, patch: unknown): Promise<ActionResult> {
  return run(async (user) => {
    if (!isObj(patch)) throw new BlockedError("Invalid project");
    const out: Parameters<typeof updateProject>[2] = {};
    const name = optText(patch.name, "Project name");
    if (name !== undefined) out.name = name ?? "";
    const priority = optText(patch.priority, "Priority");
    if (priority !== undefined) out.priority = (priority ?? "") as Priority;
    const due = optText(patch.dueDate, "Due date");
    if (due !== undefined) out.dueDate = due || null;
    await updateProject(user, idArg(projectId), out);
  });
}

export async function setProjectArchivedAction(projectId: unknown, archived: unknown): Promise<ActionResult> {
  return run(async (user) => {
    if (typeof archived !== "boolean") throw new BlockedError("Invalid request");
    await setProjectArchived(user, idArg(projectId), archived);
  });
}
