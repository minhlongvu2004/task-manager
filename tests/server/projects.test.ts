import { beforeEach, describe, expect, it } from "vitest";
import { BlockedError, NotFoundError } from "@/server/errors";
import type { SessionUser } from "@/server/access";
import { addMemberByEmail, createTeam } from "@/server/teams";
import { createProject, getProject, listProjects, setProjectArchived, updateProject } from "@/server/projects";
import { setup } from "./fixtures";

let owner: SessionUser, alice: SessionUser, bob: SessionUser;
let tA: string, tB: string;
beforeEach(async () => {
  ({ owner, alice, bob } = await setup());
  tA = (await createTeam(owner, { name: "A", color: "#ffffff" })).id;
  tB = (await createTeam(owner, { name: "B", color: "#ffffff" })).id;
  await addMemberByEmail(owner, tA, "alice@example.com");
});

describe("projects", () => {
  it("non-member gets NotFoundError on existing project; bad uuid too", async () => {
    const p = await createProject(owner, { teamId: tA, name: "P", priority: "high", dueDate: "2026-12-01" });
    await expect(getProject(bob, p.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateProject(bob, p.id, { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(setProjectArchived(bob, p.id, true)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getProject(alice, "nope")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getProject(alice, "00000000-0000-4000-8000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
    expect((await getProject(alice, p.id)).name).toBe("P");
    expect((await getProject(owner, p.id)).id).toBe(p.id);
  });

  it("cannot create in a team the user cannot see", async () => {
    await expect(
      createProject(alice, { teamId: tB, name: "P", priority: "normal", dueDate: null }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("listProjects scopes by team, sorts, hides archived", async () => {
    const a1 = await createProject(owner, { teamId: tA, name: "Zed", priority: "urgent", dueDate: null });
    const a2 = await createProject(owner, { teamId: tA, name: "Abe", priority: "normal", dueDate: null });
    await createProject(owner, { teamId: tB, name: "Hidden", priority: "urgent", dueDate: null });
    expect((await listProjects(alice, {})).map((p) => p.name)).toEqual(["Zed", "Abe"]);
    expect(await listProjects(bob, {})).toEqual([]);
    expect((await listProjects(owner, {})).length).toBe(3);
    await setProjectArchived(alice, a2.id, true);
    expect((await listProjects(alice, {})).map((p) => p.id)).toEqual([a1.id]);
    expect((await listProjects(alice, { includeArchived: true })).length).toBe(2);
    await setProjectArchived(alice, a2.id, false);
    expect((await listProjects(alice, {})).length).toBe(2);
  });

  it("validates fields", async () => {
    const base = { teamId: tA, name: "x", priority: "normal" as const, dueDate: null };
    await expect(createProject(owner, { ...base, name: "  " })).rejects.toBeInstanceOf(BlockedError);
    await expect(createProject(owner, { ...base, name: "x".repeat(201) })).rejects.toBeInstanceOf(BlockedError);
    await expect(createProject(owner, { ...base, dueDate: "2026-13-45" })).rejects.toBeInstanceOf(BlockedError);
    await expect(createProject(owner, { ...base, priority: "bogus" as never })).rejects.toBeInstanceOf(BlockedError);
    const p = await createProject(owner, { ...base, name: " ok " });
    expect(p.name).toBe("ok");
    const u = await updateProject(owner, p.id, { priority: "urgent", dueDate: "2026-02-28" });
    expect(u.priority).toBe("urgent");
    expect(u.dueDate).toBe("2026-02-28");
    await expect(updateProject(owner, p.id, { dueDate: "2026-02-30" })).rejects.toBeInstanceOf(BlockedError);
    expect((await updateProject(owner, p.id, { dueDate: null })).dueDate).toBeNull();
  });
});
