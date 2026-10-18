import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { allowedEmails, tasks, users } from "@/db/schema";
import { ensureUserOnSignIn, type SessionUser } from "@/server/access";
import { BlockedError, NotFoundError } from "@/server/errors";
import { addMemberByEmail, createTeam, deleteTeam, listTeamMembers, listTeams, removeMember } from "@/server/teams";
import { createProject, setProjectArchived } from "@/server/projects";
import { createTask, updateTask } from "@/server/tasks";
import { setup } from "./fixtures";

let owner: SessionUser, alice: SessionUser, bob: SessionUser;
beforeEach(async () => {
  ({ owner, alice, bob } = await setup());
});

describe("teams", () => {
  it("createTeam adds the creator as member; owner sees all teams, members only theirs", async () => {
    const t = await createTeam(owner, { name: "Alpha", color: "#f00" });
    const members = await listTeamMembers(owner, t.id);
    expect(members.map((m) => m.email)).toContain("owner@example.com");
    await addMemberByEmail(owner, t.id, "alice@example.com");
    await createTeam(owner, { name: "Beta", color: "#0f0" });
    expect((await listTeams(owner)).map((x) => x.name).sort()).toEqual(["Alpha", "Beta"]);
    expect((await listTeams(alice)).map((x) => x.name)).toEqual(["Alpha"]);
    expect(await listTeams(bob)).toEqual([]);
  });

  it("validates name and color", async () => {
    await expect(createTeam(owner, { name: "  ", color: "#fff" })).rejects.toBeInstanceOf(BlockedError);
    await expect(createTeam(owner, { name: "x", color: " " })).rejects.toBeInstanceOf(BlockedError);
  });

  it("addMemberByEmail works for never-signed-in email and sign-in reuses the row", async () => {
    const t = await createTeam(owner, { name: "T", color: "#fff" });
    const m = await addMemberByEmail(owner, t.id, "  New@Example.COM ");
    expect(m.email).toBe("new@example.com");
    expect(m.name).toBeNull();
    const again = await addMemberByEmail(owner, t.id, "new@example.com");
    expect(again.id).toBe(m.id);
    expect(await db.select().from(allowedEmails).where(eq(allowedEmails.email, "new@example.com"))).toHaveLength(1);
    const su = await ensureUserOnSignIn("new@example.com", "Newbie");
    expect(su!.id).toBe(m.id);
    expect(await db.select().from(users).where(eq(users.email, "new@example.com"))).toHaveLength(1);
    expect((await listTeamMembers(owner, t.id)).filter((x) => x.id === m.id)).toHaveLength(1);
  });

  it("addMemberByEmail rejects bad emails and non-members", async () => {
    const t = await createTeam(owner, { name: "T", color: "#fff" });
    await expect(addMemberByEmail(owner, t.id, "nope")).rejects.toBeInstanceOf(BlockedError);
    await expect(addMemberByEmail(bob, t.id, "x@example.com")).rejects.toBeInstanceOf(NotFoundError);
    await expect(listTeamMembers(bob, t.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(addMemberByEmail(owner, "not-a-uuid", "x@example.com")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("a plain member can add members to their own team", async () => {
    const t = await createTeam(owner, { name: "T", color: "#fff" });
    await addMemberByEmail(owner, t.id, "alice@example.com");
    const m = await addMemberByEmail(alice, t.id, "bob@example.com");
    expect(m.id).toBe(bob.id);
  });

  describe("removeMember", () => {
    let teamId: string, projectId: string;
    beforeEach(async () => {
      teamId = (await createTeam(owner, { name: "T", color: "#fff" })).id;
      await addMemberByEmail(owner, teamId, "alice@example.com");
      projectId = (await createProject(owner, { teamId, name: "P", priority: "normal", dueDate: null })).id;
    });

    it("returns assigned tasks to unassigned", async () => {
      const task = await createTask(owner, projectId, { title: "a", ownerId: alice.id, dueDate: null });
      await removeMember(owner, teamId, alice.id);
      const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id));
      expect(row.status).toBe("unassigned");
      expect(row.ownerId).toBeNull();
      expect((await listTeamMembers(owner, teamId)).map((m) => m.id)).not.toContain(alice.id);
    });

    it("is blocked while the member owns doing or pending tasks, works after reassigning", async () => {
      const t1 = await createTask(owner, projectId, { title: "a", ownerId: alice.id, dueDate: null });
      const t2 = await createTask(owner, projectId, { title: "b", ownerId: alice.id, dueDate: null });
      await updateTask(owner, t1.id, { status: "doing" });
      await updateTask(owner, t2.id, { status: "pending", stuckReason: "no API key" });
      await expect(removeMember(owner, teamId, alice.id)).rejects.toThrow("Reassign 2 tasks first");
      await updateTask(owner, t1.id, { ownerId: owner.id });
      await expect(removeMember(owner, teamId, alice.id)).rejects.toThrow("Reassign 1 tasks first");
      await updateTask(owner, t2.id, { ownerId: owner.id });
      await removeMember(owner, teamId, alice.id);
      expect((await listTeamMembers(owner, teamId)).map((m) => m.id)).not.toContain(alice.id);
    });

    it("keeps succeeded tasks owned", async () => {
      const t1 = await createTask(owner, projectId, { title: "a", ownerId: alice.id, dueDate: null });
      await updateTask(owner, t1.id, { status: "succeeded" });
      await removeMember(owner, teamId, alice.id);
      const [row] = await db.select().from(tasks).where(eq(tasks.id, t1.id));
      expect(row.ownerId).toBe(alice.id);
      expect(row.status).toBe("succeeded");
    });

    it("non-member cannot remove", async () => {
      await expect(removeMember(bob, teamId, alice.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  it("deleteTeam is blocked with projects (even archived) and works when empty", async () => {
    const t = await createTeam(owner, { name: "T", color: "#fff" });
    await expect(deleteTeam(bob, t.id)).rejects.toBeInstanceOf(NotFoundError);
    const p = await createProject(owner, { teamId: t.id, name: "P", priority: "normal", dueDate: null });
    await expect(deleteTeam(owner, t.id)).rejects.toBeInstanceOf(BlockedError);
    await setProjectArchived(owner, p.id, true);
    await expect(deleteTeam(owner, t.id)).rejects.toBeInstanceOf(BlockedError);
    const t2 = await createTeam(owner, { name: "Empty", color: "#fff" });
    await deleteTeam(owner, t2.id);
    expect((await listTeams(owner)).map((x) => x.id)).not.toContain(t2.id);
  });
});
