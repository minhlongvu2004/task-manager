import { describe, expect, it } from "vitest";
import { newTaskState, setOwner, setStatus, validateTitle } from "@/lib/domain/task-rules";

describe("newTaskState", () => {
  it("is unassigned with no owner when ownerId is null", () => {
    expect(newTaskState(null)).toEqual({ status: "unassigned", ownerId: null, stuckReason: null });
  });

  it("is assigned when given an owner", () => {
    expect(newTaskState("u1").status).toBe("assigned");
  });
});

describe("setOwner", () => {
  it("assigns an unassigned task", () => {
    const r = setOwner(newTaskState(null), "u1");
    expect(r).toMatchObject({ ok: true, state: { status: "assigned", ownerId: "u1" } });
  });

  it("unassigns an assigned task when owner is removed", () => {
    const r = setOwner(newTaskState("u1"), null);
    expect(r).toMatchObject({ ok: true, state: { status: "unassigned", ownerId: null } });
  });

  it.each(["doing", "pending", "succeeded"] as const)("refuses to remove owner from %s", (status) => {
    const base = { status, ownerId: "u1", stuckReason: status === "pending" ? "blocked" : null };
    expect(setOwner(base, null).ok).toBe(false);
  });

  it("changes owner on a doing task and keeps the status", () => {
    const r = setOwner({ status: "doing", ownerId: "u1", stuckReason: null }, "u2");
    expect(r).toMatchObject({ ok: true, state: { status: "doing", ownerId: "u2" } });
  });
});

describe("setStatus", () => {
  it("refuses pending without a stuckReason", () => {
    expect(setStatus(newTaskState("u1"), "pending").ok).toBe(false);
  });

  it("refuses pending with a blank stuckReason", () => {
    expect(setStatus(newTaskState("u1"), "pending", { stuckReason: "   " }).ok).toBe(false);
  });

  it("stores the trimmed stuckReason when moving to pending", () => {
    const r = setStatus(newTaskState("u1"), "pending", { stuckReason: " no API key " });
    expect(r).toMatchObject({ ok: true, state: { status: "pending", stuckReason: "no API key" } });
  });

  it("clears stuckReason when leaving pending", () => {
    const pending = { status: "pending" as const, ownerId: "u1", stuckReason: "no API key" };
    const r = setStatus(pending, "doing");
    expect(r).toMatchObject({ ok: true, state: { status: "doing", stuckReason: null } });
  });

  it("clears ownerId when moving to unassigned", () => {
    const r = setStatus({ status: "doing", ownerId: "u1", stuckReason: null }, "unassigned");
    expect(r).toMatchObject({ ok: true, state: { status: "unassigned", ownerId: null, stuckReason: null } });
  });

  it("refuses doing when there is no owner", () => {
    expect(setStatus(newTaskState(null), "doing").ok).toBe(false);
  });

  it("refuses assigned, pending and succeeded when there is no owner", () => {
    const none = newTaskState(null);
    expect(setStatus(none, "assigned").ok).toBe(false);
    expect(setStatus(none, "pending", { stuckReason: "x" }).ok).toBe(false);
    expect(setStatus(none, "succeeded").ok).toBe(false);
  });

  it("allows succeeded to doing", () => {
    const r = setStatus({ status: "succeeded", ownerId: "u1", stuckReason: null }, "doing");
    expect(r).toMatchObject({ ok: true, state: { status: "doing", ownerId: "u1" } });
  });
});

describe("validateTitle", () => {
  it("rejects a blank title", () => {
    expect(validateTitle("  ")).toMatchObject({ ok: false });
  });

  it("rejects a title longer than 200 characters", () => {
    expect(validateTitle("a".repeat(201)).ok).toBe(false);
  });

  it("accepts exactly 200 characters", () => {
    const r = validateTitle("a".repeat(200));
    expect(r).toEqual({ ok: true, title: "a".repeat(200) });
  });

  it("trims the title", () => {
    expect(validateTitle("  Fix footer ")).toEqual({ ok: true, title: "Fix footer" });
  });

  it("keeps HTML in the title as plain text, unchanged", () => {
    expect(validateTitle("<b>Fix</b> footer")).toEqual({ ok: true, title: "<b>Fix</b> footer" });
  });
});
