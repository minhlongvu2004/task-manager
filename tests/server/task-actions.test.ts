import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlockedError, NotFoundError } from "@/server/errors";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  restoreTask: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/server/access", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/server/tasks", () => ({
  createTask: mocks.createTask,
  updateTask: mocks.updateTask,
  deleteTask: mocks.deleteTask,
  restoreTask: mocks.restoreTask,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  createTaskAction,
  deleteTaskAction,
  restoreTaskAction,
  updateTaskAction,
} from "@/app/projects/[id]/actions";

const user = { id: "u1", email: "a@example.com", isWorkspaceOwner: false };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSessionUser.mockResolvedValue(user);
});

describe("task server actions", () => {
  it("returns Not signed in without calling the data layer", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    expect(await deleteTaskAction("t")).toEqual({ ok: false, error: "Not signed in" });
    expect(mocks.deleteTask).not.toHaveBeenCalled();
  });

  it("maps BlockedError to its message and NotFoundError to Not found", async () => {
    mocks.updateTask.mockRejectedValue(new BlockedError("A task that is doing must keep its owner"));
    expect(await updateTaskAction("t", { ownerId: null })).toEqual({
      ok: false,
      error: "A task that is doing must keep its owner",
    });
    mocks.restoreTask.mockRejectedValue(new NotFoundError("Task not found for someone else"));
    expect(await restoreTaskAction("t")).toEqual({ ok: false, error: "Not found" });
  });

  it("rethrows unexpected errors", async () => {
    mocks.deleteTask.mockRejectedValue(new Error("db password leaked"));
    await expect(deleteTaskAction("t")).rejects.toThrow("db password leaked");
  });

  it("acts as the session user and revalidates on success", async () => {
    mocks.createTask.mockResolvedValue({});
    const res = await createTaskAction("p1", { title: "Hi", ownerId: "o1", dueDate: "", userId: "evil" });
    expect(res).toEqual({ ok: true });
    expect(mocks.createTask).toHaveBeenCalledWith(user, "p1", { title: "Hi", ownerId: "o1", dueDate: null });
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("rejects non-string and malformed arguments as Blocked/Not found without calling the data layer", async () => {
    expect(await createTaskAction("p1", { title: 5 })).toEqual({ ok: false, error: "Title must be text" });
    expect(await createTaskAction("p1", "nope")).toEqual({ ok: false, error: "Invalid task" });
    expect(await updateTaskAction("t", { status: "bogus" })).toEqual({ ok: false, error: "Invalid status" });
    expect(await deleteTaskAction({ id: "t" })).toEqual({ ok: false, error: "Not found" });
    expect(mocks.createTask).not.toHaveBeenCalled();
    expect(mocks.updateTask).not.toHaveBeenCalled();
    expect(mocks.deleteTask).not.toHaveBeenCalled();
  });

  it("passes only known patch fields to updateTask", async () => {
    mocks.updateTask.mockResolvedValue({});
    await updateTaskAction("t", { title: "X", status: "pending", stuckReason: "why", ownerId: "", extra: 1 });
    expect(mocks.updateTask).toHaveBeenCalledWith(user, "t", { title: "X", status: "pending", stuckReason: "why", ownerId: null });
  });
});
