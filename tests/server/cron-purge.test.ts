import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { tasks, verificationTokens } from "@/db/schema";
import { createTeam } from "@/server/teams";
import { createProject } from "@/server/projects";
import { createTask } from "@/server/tasks";
import { POST } from "@/app/api/cron/purge/route";
import { setup } from "./fixtures";

const call = (auth?: string) =>
  POST(new Request("http://x/api/cron/purge", { method: "POST", headers: auth ? { authorization: auth } : {} }));

let taskId: string;
beforeEach(async () => {
  const { owner } = await setup();
  const team = await createTeam(owner, { name: "T", color: "#ffffff" });
  const p = await createProject(owner, { teamId: team.id, name: "P", priority: "normal", dueDate: null });
  taskId = (await createTask(owner, p.id, { title: "old", ownerId: null, dueDate: null })).id;
  await db.update(tasks).set({ deletedAt: new Date(Date.now() - 40 * 86_400_000) }).where(eq(tasks.id, taskId));
  vi.stubEnv("CRON_SECRET", "s3cret");
});
afterEach(() => vi.unstubAllEnvs());

const remaining = async () => (await db.select({ id: tasks.id }).from(tasks)).length;

describe("POST /api/cron/purge", () => {
  it("401 without the header", async () => {
    expect((await call()).status).toBe(401);
    expect(await remaining()).toBe(1);
  });
  it("401 with a wrong secret", async () => {
    expect((await call("Bearer nope")).status).toBe(401);
    expect((await call("s3cret")).status).toBe(401); // missing Bearer scheme
    expect(await remaining()).toBe(1);
  });
  it("401 when CRON_SECRET is unset or empty, even for an empty bearer", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect((await call("Bearer anything")).status).toBe(401);
    vi.stubEnv("CRON_SECRET", undefined);
    expect((await call("Bearer ")).status).toBe(401);
    expect(await remaining()).toBe(1);
  });
  it("purges and returns the count with the right secret", async () => {
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ purged: 1, tokensPurged: 0 });
    expect(await remaining()).toBe(0);
  });
  it("deletes expired verification tokens and keeps valid ones", async () => {
    await db.insert(verificationTokens).values([
      { identifier: "a@example.com", token: "old", expires: new Date(Date.now() - 60_000) },
      { identifier: "b@example.com", token: "fresh", expires: new Date(Date.now() + 3_600_000) },
    ]);
    const res = await call("Bearer s3cret");
    expect(await res.json()).toEqual({ purged: 1, tokensPurged: 1 });
    expect((await db.select().from(verificationTokens)).map((r) => r.token)).toEqual(["fresh"]);
  });
});
