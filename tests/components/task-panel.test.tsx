import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskPanel } from "@/components/TaskPanel";
import { Toast } from "@/components/Toast";
import type { TaskItem } from "@/components/TaskList";

const members = [
  { id: "u1", label: "Sam" },
  { id: "u2", label: "Ana" },
];
const base: TaskItem = { id: "t1", title: "Build header", status: "doing", ownerId: "u1", dueDate: "2026-10-24", stuckReason: null };

function panel(mode: "create" | "edit", task?: TaskItem, over: Partial<Parameters<typeof TaskPanel>[0]> = {}) {
  const props = { onSubmit: vi.fn().mockResolvedValue({ ok: true }), onDelete: vi.fn(), onClose: vi.fn(), ...over };
  render(<TaskPanel mode={mode} task={task} members={members} {...props} />);
  return props;
}
const save = () => screen.getByRole("button", { name: /^(Save|Create task)$/ });
const owner = () => screen.getByLabelText(/^Owner/) as HTMLSelectElement;

describe("TaskPanel", () => {
  it("disables Save for a blank title and enables it once typed", async () => {
    panel("create");
    expect(save()).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Title"), "   ");
    expect(save()).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Title"), "Write copy");
    expect(save()).toBeEnabled();
  });

  it("choosing Pending reveals a required stuck reason and keeps Save disabled until filled", async () => {
    panel("edit", base);
    expect(screen.queryByLabelText("Why is it stuck?")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Status"), "pending");
    const why = screen.getByLabelText("Why is it stuck?");
    expect(why).toBeRequired();
    expect(save()).toBeDisabled();
    await userEvent.type(why, "   ");
    expect(save()).toBeDisabled();
    await userEvent.type(why, "No API key");
    expect(save()).toBeEnabled();
  });

  it("has no Nobody option for Doing, Pending and Succeeded tasks", () => {
    for (const status of ["doing", "pending", "succeeded"] as const) {
      panel("edit", { ...base, status, stuckReason: status === "pending" ? "x" : null });
      expect(Array.from(owner().options).map((o) => o.text)).not.toContain("Nobody");
      document.body.innerHTML = "";
    }
  });

  it("offers Nobody on Assigned, and stops offering it when the form status becomes Doing", async () => {
    panel("edit", { ...base, status: "assigned" });
    expect(Array.from(owner().options).map((o) => o.text)).toContain("Nobody");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "doing");
    expect(Array.from(owner().options).map((o) => o.text)).not.toContain("Nobody");
  });

  it("choosing an owner on an Unassigned task sets the status to Assigned; clearing goes back", async () => {
    panel("edit", { ...base, status: "unassigned", ownerId: null });
    const status = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(status.value).toBe("unassigned");
    await userEvent.selectOptions(owner(), "u2");
    expect(status.value).toBe("assigned");
    await userEvent.selectOptions(owner(), "");
    expect(status.value).toBe("unassigned");
  });

  it("choosing status Unassigned clears the owner", async () => {
    panel("edit", { ...base, status: "assigned" });
    await userEvent.selectOptions(screen.getByLabelText("Status"), "unassigned");
    expect(owner().value).toBe("");
  });

  it("keeps Save disabled when moving an ownerless task to Doing", async () => {
    panel("edit", { ...base, status: "unassigned", ownerId: null });
    await userEvent.selectOptions(screen.getByLabelText("Status"), "doing");
    expect(save()).toBeDisabled();
    await userEvent.selectOptions(owner(), "u1");
    expect(save()).toBeEnabled();
  });

  it("due date is a date input and the value passes through unchanged", async () => {
    const p = panel("edit", base);
    const due = screen.getByLabelText("Due date") as HTMLInputElement;
    expect(due.type).toBe("date");
    expect(due.value).toBe("2026-10-24");
    await userEvent.click(save());
    expect(p.onSubmit).toHaveBeenCalledWith({
      title: "Build header",
      status: "doing",
      ownerId: "u1",
      dueDate: "2026-10-24",
      stuckReason: "",
    });
  });

  it("create mode has no status field and submits an assigned owner", async () => {
    const p = panel("create");
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Title"), "New one");
    await userEvent.selectOptions(owner(), "u2");
    await userEvent.click(save());
    expect(p.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: "New one", ownerId: "u2", status: "assigned", dueDate: null }));
  });

  it("shows an error returned by onSubmit", async () => {
    panel("edit", base, { onSubmit: vi.fn().mockResolvedValue({ ok: false, error: "Owner must be a member of the team" }) });
    await userEvent.click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent("Owner must be a member of the team");
  });

  it("Delete (edit mode only) and Cancel call their handlers", async () => {
    const p = panel("edit", base);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(p.onDelete).toHaveBeenCalled();
    expect(p.onClose).toHaveBeenCalled();
    document.body.innerHTML = "";
    panel("create");
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});

describe("Toast", () => {
  afterEach(() => vi.useRealTimers());

  it("Undo calls the handler", async () => {
    const onUndo = vi.fn();
    render(<Toast message="Task deleted" onUndo={onUndo} onExpire={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalled();
  });

  it("expires after about 4 seconds, not before", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    render(<Toast message="Task deleted" onUndo={() => {}} onExpire={onExpire} />);
    expect(screen.getByText(/Task deleted/)).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(3900));
    expect(onExpire).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(200));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
