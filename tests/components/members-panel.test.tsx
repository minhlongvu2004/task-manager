import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addMemberAction: vi.fn(),
  removeMemberAction: vi.fn(),
  deleteTeamAction: vi.fn(),
  createTeamAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/teams", () => ({
  addMemberAction: mocks.addMemberAction,
  removeMemberAction: mocks.removeMemberAction,
  deleteTeamAction: mocks.deleteTeamAction,
  createTeamAction: mocks.createTeamAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));

import { MembersPanel } from "@/components/MembersPanel";
import { NewTeamDialog } from "@/components/NewTeamDialog";

const members = [
  { id: "u1", email: "sam@example.com", name: "Sam" },
  { id: "u2", email: "ana@example.com", name: null },
];

function panel() {
  const onClose = vi.fn();
  render(<MembersPanel teamId="t1" teamName="Design" members={members} onClose={onClose} />);
  return { onClose };
}

beforeEach(() => vi.resetAllMocks());

describe("MembersPanel", () => {
  it("is a labelled dialog that closes on Escape", async () => {
    const { onClose } = panel();
    expect(screen.getByRole("dialog", { name: /Design/ })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("adding a member shows them in the list", async () => {
    mocks.addMemberAction.mockResolvedValue({ ok: true, member: { id: "u3", email: "new@example.com", name: null } });
    panel();
    await userEvent.type(screen.getByLabelText("Email"), "new@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(mocks.addMemberAction).toHaveBeenCalledWith("t1", "new@example.com");
    expect(await screen.findByText("new@example.com")).toBeInTheDocument();
  });

  it("shows the error when adding fails and does not list the person", async () => {
    mocks.addMemberAction.mockResolvedValue({ ok: false, error: "Ask the workspace owner to invite them first" });
    panel();
    await userEvent.type(screen.getByLabelText("Email"), "x@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ask the workspace owner to invite them first");
    expect(screen.queryByText("x@example.com")).not.toBeInTheDocument();
  });

  it("removing a member who owns active tasks shows the Reassign error and keeps them", async () => {
    mocks.removeMemberAction.mockResolvedValue({ ok: false, error: "Reassign 2 tasks first" });
    panel();
    await userEvent.click(screen.getByRole("button", { name: "Remove ana@example.com" }));
    expect(mocks.removeMemberAction).toHaveBeenCalledWith("t1", "u2");
    expect(await screen.findByRole("alert")).toHaveTextContent("Reassign 2 tasks first");
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("removes a member from the list on success", async () => {
    mocks.removeMemberAction.mockResolvedValue({ ok: true });
    panel();
    await userEvent.click(screen.getByRole("button", { name: "Remove ana@example.com" }));
    await waitFor(() => expect(screen.queryByText("ana@example.com")).not.toBeInTheDocument());
  });

  it("deleting a team that has projects shows the block message", async () => {
    mocks.deleteTeamAction.mockResolvedValue({ ok: false, error: "Delete or move this team's projects first" });
    const { onClose } = panel();
    await userEvent.click(screen.getByRole("button", { name: "Delete team" }));
    expect(mocks.deleteTeamAction).toHaveBeenCalledWith("t1");
    expect(await screen.findByRole("alert")).toHaveTextContent("Delete or move this team's projects first");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("NewTeamDialog", () => {
  it("is labelled, focuses the name field, requires a name, and offers fixed swatches only", async () => {
    const onClose = vi.fn();
    render(<NewTeamDialog onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "New team" })).toBeInTheDocument();
    expect(screen.getByLabelText("Team name")).toHaveFocus();
    expect(screen.queryByLabelText(/color/i, { selector: "input[type=text]" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio").length).toBeGreaterThanOrEqual(6);
    expect(screen.getByRole("button", { name: "Create team" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("submits the name and the chosen hex color, then shows errors from the action", async () => {
    mocks.createTeamAction.mockResolvedValue({ ok: false, error: "Team name is required" });
    render(<NewTeamDialog onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Team name"), "Ops");
    const second = screen.getAllByRole("radio")[1];
    await userEvent.click(second);
    await userEvent.click(screen.getByRole("button", { name: "Create team" }));
    expect(mocks.createTeamAction).toHaveBeenCalledWith({ name: "Ops", color: expect.stringMatching(/^#[0-9a-f]{6}$/i) });
    expect(await screen.findByRole("alert")).toHaveTextContent("Team name is required");
  });
});
