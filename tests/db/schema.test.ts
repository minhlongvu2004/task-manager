import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, tasks, teams, workspaces } from "@/db/schema";
import { resetDb } from "./helpers";

async function seedProject(extra: Partial<typeof projects.$inferInsert> = {}) {
  const [ws] = await db.insert(workspaces).values({ name: "WS" }).returning();
  const [team] = await db.insert(teams).values({ workspaceId: ws.id, name: "T", color: "#fff" }).returning();
  const [project] = await db
    .insert(projects)
    .values({ teamId: team.id, name: "P", ...extra })
    .returning();
  return project;
}

describe("schema", () => {
  beforeEach(resetDb);

  it("stores a task with defaults and a plain-text due date", async () => {
    const project = await seedProject();
    const [inserted] = await db
      .insert(tasks)
      .values({ projectId: project.id, title: "Do it", dueDate: "2026-11-12" })
      .returning();
    const [task] = await db.select().from(tasks).where(eq(tasks.id, inserted.id));
    expect(task.status).toBe("unassigned");
    expect(task.deletedAt).toBeNull();
    expect(task.dueDate).toBe("2026-11-12");
    expect(project.priority).toBe("normal");
    expect(project.state).toBe("active");
  });

  it("rejects invalid status, priority and state via CHECK constraints", async () => {
    const project = await seedProject();
    await expect(
      db.insert(tasks).values({ projectId: project.id, title: "x", status: "bogus" as never }),
    ).rejects.toThrow();
    await expect(seedProject({ priority: "bogus" as never })).rejects.toThrow();
    await expect(seedProject({ state: "bogus" as never })).rejects.toThrow();
  });
});
