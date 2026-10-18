import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTaskAction: vi.fn(),
  deleteTaskAction: vi.fn(),
  restoreTaskAction: vi.fn(),
  updateTaskAction: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/app/projects/[id]/actions", () => ({
  createTaskAction: mocks.createTaskAction,
  deleteTaskAction: mocks.deleteTaskAction,
  restoreTaskAction: mocks.restoreTaskAction,
  updateTaskAction: mocks.updateTaskAction,
}));
vi.mock("@/auth", () => ({ signOut: mocks.signOut }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { PriorityLabel } from "@/components/PriorityLabel";
import { ProjectRow } from "@/components/ProjectRow";
import { ProjectWorkspace, buildPatch } from "@/components/ProjectWorkspace";
import { RestoreButton } from "@/components/RestoreButton";
import { Sidebar } from "@/components/Sidebar";
import { TaskList, type TaskItem } from "@/components/TaskList";

const zero = { unassigned: 0, assigned: 0, doing: 0, pending: 0, succeeded: 0 };
const members = [{ id: "u1", label: "Sam" }];
const task = (over: Partial<TaskItem> = {}): TaskItem => ({
  id: "t1",
  title: "Build header",
  status: "doing",
  ownerId: "u1",
  dueDate: null,
  stuckReason: null,
  ...over,
});

beforeEach(() => vi.resetAllMocks());

describe("PriorityLabel", () => {
  it("renders nothing for normal, red URGENT, orange HIGH", () => {
    const { container, rerender } = render(<PriorityLabel priority="normal" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<PriorityLabel priority="urgent" />);
    expect(screen.getByText("URGENT").className).toMatch(/red/);
    rerender(<PriorityLabel priority="high" />);
    expect(screen.getByText("HIGH").className).toMatch(/orange/);
    expect(screen.queryByText("NORMAL")).not.toBeInTheDocument();
  });
});

describe("ProjectRow status colors", () => {
  it("only the Pending count is amber; Doing and Succeeded are neutral", () => {
    render(
      <ProjectRow
        project={{ id: "p", name: "P", priority: "normal", dueDate: null }}
        counts={{ ...zero, doing: 1, pending: 1, succeeded: 1 }}
        today="2026-10-18"
      />,
    );
    expect(screen.getByText("1 Pending").className).toMatch(/amber/);
    for (const t of ["1 Doing", "1 Succeeded"]) expect(screen.getByText(t).className).not.toMatch(/blue|green|amber|red/);
  });
});

describe("TaskList due colors", () => {
  it("does not mark a Succeeded task's past due date red, but does for a Doing one", () => {
    render(
      <TaskList
        tasks={[task({ id: "a", status: "succeeded", dueDate: "2026-10-01" }), task({ id: "b", status: "doing", dueDate: "2026-10-02" })]}
        members={members}
        today="2026-10-18"
      />,
    );
    expect(screen.getByText("Oct 1").className).not.toMatch(/red/);
    expect(screen.getByText("Oct 2").className).toMatch(/red/);
  });
});

describe("Sidebar", () => {
  it("has Projects and a Sign out control", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});

describe("buildPatch", () => {
  it("does not send ownerId when a former member's owner is unchanged", () => {
    const t = task({ status: "succeeded", ownerId: "gone" });
    const patch = buildPatch(t, { title: "New title", status: "succeeded", ownerId: "gone", dueDate: null, stuckReason: "" });
    expect(patch).not.toHaveProperty("ownerId");
    expect(patch.title).toBe("New title");
  });
});

describe("ProjectWorkspace failures", () => {
  const renderWs = () =>
    render(<ProjectWorkspace projectId="p1" tasks={[task()]} counts={{ ...zero, doing: 1 }} active="doing" members={members} today="2026-10-18" />);

  it("shows the error when delete fails", async () => {
    mocks.deleteTaskAction.mockResolvedValue({ ok: false, error: "Not found" });
    renderWs();
    await userEvent.click(screen.getByText("Build header"));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });

  it("shows the error when Undo fails, and fires Undo only once", async () => {
    mocks.deleteTaskAction.mockResolvedValue({ ok: true });
    let finish: (v: unknown) => void = () => {};
    mocks.restoreTaskAction.mockImplementation(() => new Promise((r) => (finish = r)));
    renderWs();
    await userEvent.click(screen.getByText("Build header"));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const undo = await screen.findByRole("button", { name: "Undo" });
    await userEvent.click(undo);
    await userEvent.click(undo);
    expect(mocks.restoreTaskAction).toHaveBeenCalledTimes(1);
    expect(undo).toBeDisabled();
    finish({ ok: false, error: "Not found" });
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });
});

describe("RestoreButton", () => {
  it("shows the error text when the restore fails", async () => {
    mocks.restoreTaskAction.mockResolvedValue({ ok: false, error: "Not found" });
    render(<RestoreButton taskId="t1" />);
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
    expect(mocks.restoreTaskAction).toHaveBeenCalledWith("t1");
  });
  it("shows nothing extra on success", async () => {
    mocks.restoreTaskAction.mockResolvedValue({ ok: true });
    render(<RestoreButton taskId="t1" />);
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(mocks.restoreTaskAction).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
