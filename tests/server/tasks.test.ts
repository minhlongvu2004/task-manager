import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { tasks } from "@/db/schema";
import { BlockedError, NotFoundError } from "@/server/errors";
import type { SessionUser } from "@/server/access";
import { addMemberByEmail, createTeam } from "@/server/teams";
import { createProject } from "@/server/projects";
import {
  createTask,
  deleteTask,
  listTasks,
  listTrash,
  purgeTrash,
  restoreTask,
  taskCounts,
  updateTask,
} from "@/server/tasks";
import { setup } from "./fixtures";

let owner: SessionUser, alice: SessionUser, bob: SessionUser;
let pA: string, pB: string;
beforeEach(async () => {
  ({ owner, alice, bob } = await setup());
  const tA = (await createTeam(owner, { name: "A", color: "#ffffff" })).id;
  const tB = (await createTeam(owner, { name: "B", color: "#ffffff" })).id;
  await addMemberByEmail(owner, tA, "alice@example.com");
  await addMemberByEmail(owner, tB, "bob@example.com");
  pA = (await createProject(owner, { teamId: tA, name: "PA", priority: "normal", dueDate: null })).id;
  pB = (await createProject(owner, { teamId: tB, name: "PB", priority: "normal", dueDate: null })).id;
});
const mk = (u: SessionUser, p: string, title = "t", ownerId: string | null = null) =>
  createTask(u, p, { title, ownerId, dueDate: null });

describe("access", () => {
  it("non-member gets NotFoundError for existing ids; bad uuid too", async () => {
    const t = await mk(owner, pA);
    const nf = NotFoundError;
    await expect(listTasks(bob, pA, "unassigned")).rejects.toBeInstanceOf(nf);
    await expect(taskCounts(bob, pA)).rejects.toBeInstanceOf(nf);
    await expect(listTrash(bob, pA)).rejects.toBeInstanceOf(nf);
    await expect(mk(bob, pA)).rejects.toBeInstanceOf(nf);
    await expect(updateTask(bob, t.id, { title: "x" })).rejects.toBeInstanceOf(nf);
    await expect(deleteTask(bob, t.id)).rejects.toBeInstanceOf(nf);
    await expect(restoreTask(bob, t.id)).rejects.toBeInstanceOf(nf);
    await expect(updateTask(alice, "nope", { title: "x" })).rejects.toBeInstanceOf(nf);
    await expect(listTasks(alice, "nope", "doing")).rejects.toBeInstanceOf(nf);
    await expect(deleteTask(alice, "00000000-0000-4000-8000-000000000000")).rejects.toBeInstanceOf(nf);
    const [row] = await db.select().from(tasks).where(eq(tasks.id, t.id));
    expect(row.title).toBe("t");
    expect(row.deletedAt).toBeNull();
  });
  it("owner reads every team; member only sees own team's tasks", async () => {
    await mk(owner, pA, "a");
    await mk(owner, pB, "b");
    expect(await listTasks(owner, pA, "unassigned")).toHaveLength(1);
    expect(await listTasks(owner, pB, "unassigned")).toHaveLength(1);
    expect(await listTasks(alice, pA, "unassigned")).toHaveLength(1);
    await expect(listTasks(alice, pB, "unassigned")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("create / update", () => {
  it("create unassigned vs assigned; owner must be team member", async () => {
    expect((await mk(owner, pA)).status).toBe("unassigned");
    const t = await mk(owner, pA, "x", alice.id);
    expect(t.status).toBe("assigned");
    expect(t.ownerId).toBe(alice.id);
    await expect(mk(owner, pA, "x", bob.id)).rejects.toThrow("Owner must be a member of the team");
    const t2 = await mk(owner, pA);
    await expect(updateTask(owner, t2.id, { ownerId: bob.id })).rejects.toBeInstanceOf(BlockedError);
  });
  it("team creator is a possible task owner", async () => {
    expect((await mk(owner, pA, "x", owner.id)).ownerId).toBe(owner.id);
  });
  it("pending needs reason; leaving pending clears it", async () => {
    const t = await mk(owner, pA, "x", alice.id);
    await expect(updateTask(alice, t.id, { status: "pending" })).rejects.toBeInstanceOf(BlockedError);
    const p = await updateTask(alice, t.id, { status: "pending", stuckReason: "no API key" });
    expect(p.stuckReason).toBe("no API key");
    const d = await updateTask(alice, t.id, { status: "doing" });
    expect(d.stuckReason).toBeNull();
  });
  it("already pending: title-only keeps reason; reason-only updates, blank rejected; same status no-op", async () => {
    const t = await mk(owner, pA, "x", alice.id);
    await updateTask(alice, t.id, { status: "pending", stuckReason: "r1" });
    expect((await updateTask(alice, t.id, { title: "y" })).stuckReason).toBe("r1");
    expect((await updateTask(alice, t.id, { stuckReason: "r2" })).stuckReason).toBe("r2");
    await expect(updateTask(alice, t.id, { stuckReason: "  " })).rejects.toBeInstanceOf(BlockedError);
    expect((await updateTask(alice, t.id, { status: "pending", stuckReason: "r3" })).stuckReason).toBe("r3");
    const d = await mk(owner, pA, "d", alice.id);
    await updateTask(alice, d.id, { status: "doing" });
    expect((await updateTask(alice, d.id, { status: "doing" })).status).toBe("doing");
  });
  it("combined owner+status from unassigned works; rule errors become BlockedError", async () => {
    const t = await mk(owner, pA);
    const u = await updateTask(owner, t.id, { ownerId: alice.id, status: "doing" });
    expect(u.status).toBe("doing");
    expect(u.ownerId).toBe(alice.id);
    await expect(updateTask(owner, u.id, { ownerId: null })).rejects.toBeInstanceOf(BlockedError);
    const t2 = await mk(owner, pA);
    await expect(updateTask(owner, t2.id, { status: "doing" })).rejects.toBeInstanceOf(BlockedError);
    expect((await updateTask(owner, u.id, { status: "unassigned" })).ownerId).toBeNull();
  });
  it("owner + status unassigned in one patch clears the owner", async () => {
    const t = await mk(owner, pA, "x", alice.id);
    const u = await updateTask(owner, t.id, { ownerId: alice.id, status: "unassigned" });
    expect(u.status).toBe("unassigned");
    expect(u.ownerId).toBeNull();
  });
  it("changing the owner of a pending task keeps status and reason; invalid status rejected", async () => {
    const t = await mk(owner, pA, "x", alice.id);
    await updateTask(alice, t.id, { status: "pending", stuckReason: "no API key" });
    const u = await updateTask(owner, t.id, { ownerId: owner.id });
    expect(u.ownerId).toBe(owner.id);
    expect(u.status).toBe("pending");
    expect(u.stuckReason).toBe("no API key");
    await expect(updateTask(owner, t.id, { status: "bogus" as never })).rejects.toBeInstanceOf(BlockedError);
  });
  it("validates titles and dates; HTML stored as given", async () => {
    await expect(mk(owner, pA, "   ")).rejects.toBeInstanceOf(BlockedError);
    await expect(mk(owner, pA, "x".repeat(201))).rejects.toBeInstanceOf(BlockedError);
    const t = await mk(owner, pA, "  <b>hi</b> <script>x</script> ");
    expect(t.title).toBe("<b>hi</b> <script>x</script>");
    await expect(updateTask(owner, t.id, { title: "" })).rejects.toBeInstanceOf(BlockedError);
    const bad = (dueDate: string) => createTask(owner, pA, { title: "a", ownerId: null, dueDate });
    await expect(bad("2026-13-45")).rejects.toBeInstanceOf(BlockedError);
    await expect(bad("2026-01-01T00:00:00Z")).rejects.toBeInstanceOf(BlockedError);
    await expect(updateTask(owner, t.id, { dueDate: "tomorrow" })).rejects.toBeInstanceOf(BlockedError);
    expect((await updateTask(owner, t.id, { dueDate: "2026-12-31" })).dueDate).toBe("2026-12-31");
    expect((await updateTask(owner, t.id, { dueDate: null })).dueDate).toBeNull();
  });
});

describe("lists, delete, restore, purge", () => {
  it("lists filter by status, sort, exclude deleted; counts", async () => {
    const a = await createTask(owner, pA, { title: "late", ownerId: null, dueDate: "2026-12-01" });
    const b = await createTask(owner, pA, { title: "early", ownerId: null, dueDate: "2026-01-01" });
    const c = await mk(owner, pA, "gone");
    await mk(owner, pA, "mine", alice.id);
    await deleteTask(owner, c.id);
    expect((await listTasks(owner, pA, "unassigned")).map((t) => t.id)).toEqual([b.id, a.id]);
    expect(await taskCounts(owner, pA)).toEqual({ unassigned: 2, assigned: 1, doing: 0, pending: 0, succeeded: 0 });
    expect((await listTrash(owner, pA)).map((t) => t.id)).toEqual([c.id]);
  });
  it("delete then restore returns it unchanged; deleted tasks can't be updated", async () => {
    const t = await mk(owner, pA, "x", alice.id);
    const before = await updateTask(alice, t.id, { status: "doing" });
    await deleteTask(alice, t.id);
    await expect(updateTask(alice, t.id, { title: "z" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteTask(alice, t.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await restoreTask(alice, t.id)).toEqual(before);
    await expect(restoreTask(alice, t.id)).rejects.toBeInstanceOf(NotFoundError);
  });
  it("purgeTrash removes >30 days, keeps 29 days", async () => {
    const now = new Date("2026-10-18T12:00:00Z");
    const old = await mk(owner, pA, "old");
    const recent = await mk(owner, pA, "recent");
    const live = await mk(owner, pA, "live");
    const day = 86_400_000;
    await db.update(tasks).set({ deletedAt: new Date(now.getTime() - 31 * day) }).where(eq(tasks.id, old.id));
    await db.update(tasks).set({ deletedAt: new Date(now.getTime() - 29 * day) }).where(eq(tasks.id, recent.id));
    expect(await purgeTrash(now)).toBe(1);
    const ids = (await db.select({ id: tasks.id }).from(tasks)).map((r) => r.id).sort();
    expect(ids).toEqual([recent.id, live.id].sort());
  });
});
