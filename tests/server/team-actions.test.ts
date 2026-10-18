import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlockedError, NotFoundError } from "@/server/errors";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  createTeam: vi.fn(),
  addMemberByEmail: vi.fn(),
  removeMember: vi.fn(),
  deleteTeam: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  setProjectArchived: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/server/access", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/server/teams", () => ({
  createTeam: mocks.createTeam,
  addMemberByEmail: mocks.addMemberByEmail,
  removeMember: mocks.removeMember,
  deleteTeam: mocks.deleteTeam,
}));
vi.mock("@/server/projects", () => ({
  createProject: mocks.createProject,
  updateProject: mocks.updateProject,
  setProjectArchived: mocks.setProjectArchived,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  addMemberAction,
  createProjectAction,
  createTeamAction,
  deleteTeamAction,
  removeMemberAction,
  setProjectArchivedAction,
  updateProjectAction,
} from "@/app/actions/teams";

const user = { id: "u1", email: "a@example.com", isWorkspaceOwner: false };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSessionUser.mockResolvedValue(user);
});

describe("team and project server actions", () => {
  it("returns Not signed in without calling the data layer", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    expect(await deleteTeamAction("t")).toEqual({ ok: false, error: "Not signed in" });
    expect(await createTeamAction({ name: "x", color: "#ffffff" })).toEqual({ ok: false, error: "Not signed in" });
    expect(mocks.deleteTeam).not.toHaveBeenCalled();
    expect(mocks.createTeam).not.toHaveBeenCalled();
  });

  it("maps BlockedError to its message, NotFoundError to Not found, and rethrows the rest", async () => {
    mocks.removeMember.mockRejectedValue(new BlockedError("Reassign 2 tasks first"));
    expect(await removeMemberAction("t", "m")).toEqual({ ok: false, error: "Reassign 2 tasks first" });
    mocks.deleteTeam.mockRejectedValue(new NotFoundError("secret detail"));
    expect(await deleteTeamAction("t")).toEqual({ ok: false, error: "Not found" });
    mocks.setProjectArchived.mockRejectedValue(new Error("db password leaked"));
    await expect(setProjectArchivedAction("p", true)).rejects.toThrow("db password leaked");
  });

  it("acts as the session user and ignores forged user ids", async () => {
    mocks.createProject.mockResolvedValue({ id: "p9" });
    const res = await createProjectAction({
      teamId: "t1",
      name: "Site",
      priority: "high",
      dueDate: "",
      userId: "evil",
      user: { id: "evil" },
    });
    expect(res).toEqual({ ok: true, id: "p9" });
    expect(mocks.createProject).toHaveBeenCalledWith(user, { teamId: "t1", name: "Site", priority: "high", dueDate: null });
    expect(mocks.revalidatePath).toHaveBeenCalled();

    mocks.addMemberByEmail.mockResolvedValue({ id: "m1", email: "b@example.com", name: null });
    expect(await addMemberAction("t1", "b@example.com")).toEqual({
      ok: true,
      member: { id: "m1", email: "b@example.com", name: null },
    });
    expect(mocks.addMemberByEmail).toHaveBeenCalledWith(user, "t1", "b@example.com");
  });

  it("rejects malformed arguments without calling the data layer", async () => {
    expect(await createTeamAction("nope")).toEqual({ ok: false, error: "Invalid team" });
    expect(await createTeamAction({ name: 5, color: "#ffffff" })).toEqual({ ok: false, error: "Team name must be text" });
    expect(await addMemberAction("t", { email: "x" })).toEqual({ ok: false, error: "Email must be text" });
    expect(await deleteTeamAction({ id: "t" })).toEqual({ ok: false, error: "Not found" });
    expect(await createProjectAction({ teamId: "t", name: "x", priority: 3 })).toEqual({
      ok: false,
      error: "Priority must be text",
    });
    expect(await updateProjectAction("p", "nope")).toEqual({ ok: false, error: "Invalid project" });
    expect(await setProjectArchivedAction("p", "yes")).toEqual({ ok: false, error: "Invalid request" });
    for (const k of ["createTeam", "addMemberByEmail", "deleteTeam", "createProject", "updateProject", "setProjectArchived"] as const) {
      expect(mocks[k]).not.toHaveBeenCalled();
    }
  });

  it("passes only known patch fields to updateProject", async () => {
    mocks.updateProject.mockResolvedValue({});
    await updateProjectAction("p", { name: "N", priority: "urgent", dueDate: "", extra: 1 });
    expect(mocks.updateProject).toHaveBeenCalledWith(user, "p", { name: "N", priority: "urgent", dueDate: null });
  });
});
