import type { TaskStatus } from "./status";

export type TaskState = {
  status: TaskStatus;
  ownerId: string | null;
  stuckReason: string | null;
};

export type RuleResult = { ok: true; state: TaskState } | { ok: false; error: string };

const MAX_TITLE_LENGTH = 200;

export function newTaskState(ownerId: string | null): TaskState {
  return ownerId === null
    ? { status: "unassigned", ownerId: null, stuckReason: null }
    : { status: "assigned", ownerId, stuckReason: null };
}

export function setOwner(state: TaskState, ownerId: string | null): RuleResult {
  if (ownerId !== null) {
    const status: TaskStatus = state.status === "unassigned" ? "assigned" : state.status;
    return { ok: true, state: { ...state, status, ownerId } };
  }

  if (state.status === "unassigned") {
    return { ok: true, state: { ...state, ownerId: null } };
  }
  if (state.status === "assigned") {
    return { ok: true, state: { status: "unassigned", ownerId: null, stuckReason: null } };
  }
  return { ok: false, error: `A task that is ${state.status} must keep its owner` };
}

export function setStatus(
  state: TaskState,
  status: TaskStatus,
  opts?: { stuckReason?: string },
): RuleResult {
  if (status === "unassigned") {
    return { ok: true, state: { status, ownerId: null, stuckReason: null } };
  }

  if (state.ownerId === null) {
    return { ok: false, error: `A task must have an owner to be ${status}` };
  }

  if (status === "pending") {
    const reason = opts?.stuckReason?.trim() ?? "";
    if (reason === "") {
      return { ok: false, error: "A pending task needs a reason it is stuck" };
    }
    return { ok: true, state: { status, ownerId: state.ownerId, stuckReason: reason } };
  }

  return { ok: true, state: { status, ownerId: state.ownerId, stuckReason: null } };
}

export function validateTitle(
  raw: string,
): { ok: true; title: string } | { ok: false; error: string } {
  const title = raw.trim();
  if (title === "") {
    return { ok: false, error: "Title is required" };
  }
  if (Array.from(title).length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` };
  }
  return { ok: true, title };
}
