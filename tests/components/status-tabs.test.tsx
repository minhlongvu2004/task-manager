import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StatusTabs } from "@/components/StatusTabs";
import { TaskList, type TaskItem } from "@/components/TaskList";
import { resolveTab } from "@/lib/domain/project-view";

const counts = { unassigned: 1, assigned: 2, doing: 3, pending: 4, succeeded: 5 };

describe("StatusTabs", () => {
  it("renders the five tabs in order with counts, a divider before Succeeded, and no Active/All", () => {
    render(<StatusTabs counts={counts} active="doing" />);
    const nav = screen.getByRole("navigation", { name: "Task status" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Unassigned1", "Assigned2", "Doing3", "Pending4", "Succeeded5"]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "?tab=unassigned",
      "?tab=assigned",
      "?tab=doing",
      "?tab=pending",
      "?tab=succeeded",
    ]);
    const sep = within(nav).getByRole("separator");
    expect(sep.nextElementSibling).toBe(links[4]);
    expect(screen.queryByText(/^Active/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^All/)).not.toBeInTheDocument();
  });

  it("marks the active tab and shows the Pending count in amber only", () => {
    render(<StatusTabs counts={counts} active="doing" />);
    expect(screen.getByRole("link", { name: /^Doing/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("4").className).toMatch(/amber/);
    expect(screen.getByText("3").className).not.toMatch(/amber/);
  });

  it("shows + New task on every tab and calls the handler", async () => {
    const onNew = vi.fn();
    render(<StatusTabs counts={counts} active="succeeded" onNewTask={onNew} />);
    await userEvent.click(screen.getByRole("button", { name: "+ New task" }));
    expect(onNew).toHaveBeenCalled();
  });

  it("the page default tab is Doing (resolveTab)", () => {
    expect(resolveTab(undefined)).toBe("doing");
    expect(resolveTab("nonsense")).toBe("doing");
    expect(resolveTab("pending")).toBe("pending");
  });
});

const members = [{ id: "u1", label: "Sam Lee" }];
const task = (over: Partial<TaskItem>): TaskItem => ({
  id: "t1",
  title: "A task",
  status: "doing",
  ownerId: "u1",
  dueDate: null,
  stuckReason: null,
  ...over,
});

describe("TaskList", () => {
  it("renders hostile titles as text", () => {
    const evil = "<img src=x onerror=alert(1)>";
    const { container } = render(<TaskList tasks={[task({ title: evil })]} members={members} today="2026-10-18" />);
    expect(screen.getByText(evil)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows owner initials or a dashed + assign, and no status text", () => {
    render(
      <TaskList
        tasks={[task({ id: "a", title: "Owned" }), task({ id: "b", title: "Free", status: "unassigned", ownerId: null })]}
        members={members}
        today="2026-10-18"
      />,
    );
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("+ assign").className).toMatch(/dashed/);
    for (const word of ["Doing", "Unassigned", "Assigned", "Pending", "Succeeded"]) {
      expect(screen.queryByText(word)).not.toBeInTheDocument();
    }
  });

  it("shows Stuck: reason on Pending rows only", () => {
    render(
      <TaskList
        tasks={[
          task({ id: "a", title: "P", status: "pending", stuckReason: "No API key" }),
          task({ id: "b", title: "D", stuckReason: "stale" }),
        ]}
        members={members}
        today="2026-10-18"
      />,
    );
    expect(screen.getByText("Stuck: No API key")).toBeInTheDocument();
    expect(screen.queryByText(/stale/)).not.toBeInTheDocument();
  });

  it("colors near and overdue dates red, later dates not", () => {
    render(
      <TaskList
        tasks={[
          task({ id: "a", dueDate: "2026-10-19" }),
          task({ id: "b", dueDate: "2026-10-01" }),
          task({ id: "c", dueDate: "2026-12-25" }),
        ]}
        members={members}
        today="2026-10-18"
      />,
    );
    expect(screen.getByText("Oct 19").className).toMatch(/red/);
    expect(screen.getByText("Oct 1").className).toMatch(/red/);
    expect(screen.getByText("Dec 25").className).not.toMatch(/red/);
  });

  it("calls onSelect with the task id when a row is clicked", async () => {
    const onSelect = vi.fn();
    render(<TaskList tasks={[task({})]} members={members} today="2026-10-18" onSelect={onSelect} />);
    await userEvent.click(screen.getByText("A task"));
    expect(onSelect).toHaveBeenCalledWith("t1");
  });
});

import { buildPatch } from "@/components/ProjectWorkspace";

describe("buildPatch", () => {
  const doing: TaskItem = { id: "t", title: "T", status: "doing", ownerId: "u1", dueDate: null, stuckReason: null };
  it("sends only changed owner/status, and never an owner clear when moving to Unassigned", () => {
    const v = { title: "T", status: "doing" as const, ownerId: "u1", dueDate: null, stuckReason: "" };
    expect(buildPatch(doing, v)).toEqual({ title: "T", dueDate: null });
    expect(buildPatch(doing, { ...v, status: "unassigned", ownerId: null })).toEqual({ title: "T", dueDate: null, status: "unassigned" });
    expect(buildPatch(doing, { ...v, status: "pending", stuckReason: "why" })).toEqual({
      title: "T",
      dueDate: null,
      status: "pending",
      stuckReason: "why",
    });
  });
});
