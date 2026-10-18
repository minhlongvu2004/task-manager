import { describe, expect, it } from "vitest";
import { countsByStatus, dueState, resolveTab, sortProjects, sortTasks } from "@/lib/domain/project-view";

describe("sortProjects", () => {
  it("orders by priority (urgent, high, normal), then due date, then name", () => {
    const sorted = sortProjects([
      { name: "C", priority: "normal", dueDate: "2026-01-01" },
      { name: "B", priority: "high", dueDate: "2026-02-01" },
      { name: "A", priority: "urgent", dueDate: "2026-09-01" },
      { name: "D", priority: "high", dueDate: "2026-02-01" },
      { name: "E", priority: "high", dueDate: "2026-01-15" },
      { name: "F", priority: "normal", dueDate: "2026-01-01" },
    ]);
    expect(sorted.map((p) => p.name)).toEqual(["A", "E", "B", "D", "C", "F"]);
  });

  it("puts projects with no due date last within a priority", () => {
    const sorted = sortProjects([
      { name: "X", priority: "normal", dueDate: null },
      { name: "Y", priority: "normal", dueDate: "2026-12-31" },
    ]);
    expect(sorted.map((p) => p.name)).toEqual(["Y", "X"]);
  });
});

describe("sortTasks", () => {
  it("orders by due date ascending, then created time", () => {
    const sorted = sortTasks([
      { id: "c", dueDate: null, createdAt: "2026-01-01T00:00:00Z" },
      { id: "b", dueDate: "2026-05-02", createdAt: "2026-01-03T00:00:00Z" },
      { id: "a", dueDate: "2026-05-02", createdAt: "2026-01-02T00:00:00Z" },
      { id: "d", dueDate: "2026-04-30", createdAt: "2026-01-04T00:00:00Z" },
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["d", "a", "b", "c"]);
  });

  it("puts tasks with no due date last", () => {
    const sorted = sortTasks([
      { id: "none", dueDate: null, createdAt: "2026-01-01T00:00:00Z" },
      { id: "dated", dueDate: "2027-01-01", createdAt: "2026-06-01T00:00:00Z" },
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["dated", "none"]);
  });
});

describe("resolveTab", () => {
  it("defaults to doing when the query is missing", () => {
    expect(resolveTab(undefined)).toBe("doing");
  });

  it("defaults to doing for an unknown query", () => {
    expect(resolveTab("nonsense")).toBe("doing");
  });

  it("returns a valid status query", () => {
    expect(resolveTab("pending")).toBe("pending");
  });
});

describe("countsByStatus", () => {
  it("returns zero for every status when there are no tasks", () => {
    expect(countsByStatus([])).toEqual({
      unassigned: 0,
      assigned: 0,
      doing: 0,
      pending: 0,
      succeeded: 0,
    });
  });
});

describe("dueState", () => {
  const today = "2026-10-18";

  it("is soon for today", () => {
    expect(dueState("2026-10-18", today)).toBe("soon");
  });

  it("is soon for 3 days away (inclusive)", () => {
    expect(dueState("2026-10-21", today)).toBe("soon");
  });

  it("is later for 4 days away", () => {
    expect(dueState("2026-10-22", today)).toBe("later");
  });

  it("is overdue for yesterday", () => {
    expect(dueState("2026-10-17", today)).toBe("overdue");
  });

  it("is none without a due date", () => {
    expect(dueState(null, today)).toBe("none");
  });

  it("counts days across a month boundary using UTC day numbers", () => {
    expect(dueState("2026-11-01", "2026-10-30")).toBe("soon");
    expect(dueState("2026-11-03", "2026-10-30")).toBe("later");
  });
});
