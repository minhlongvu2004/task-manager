import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProjectAction: vi.fn(),
  updateProjectAction: vi.fn(),
  setProjectArchivedAction: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  search: "team=t1&pending=1&new=project&forTeam=t2",
}));
vi.mock("@/app/actions/teams", () => ({
  createProjectAction: mocks.createProjectAction,
  updateProjectAction: mocks.updateProjectAction,
  setProjectArchivedAction: mocks.setProjectArchivedAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(mocks.search),
  usePathname: () => "/",
}));

import { NewProjectDialog } from "@/components/NewProjectDialog";
import { ProjectMenu } from "@/components/ProjectMenu";
import { TeamCard } from "@/components/TeamCard";
import { filterByArchived } from "@/lib/domain/project-view";

const teams = [
  { id: "t1", name: "Design" },
  { id: "t2", name: "Ops" },
];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.search = "team=t1&pending=1&new=project&forTeam=t2";
});

describe("NewProjectDialog", () => {
  it("is a labelled dialog with the name field focused, and Escape closes keeping the other filters", async () => {
    render(<NewProjectDialog teams={teams} defaultTeamId="t2" />);
    expect(screen.getByRole("dialog", { name: "New project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project name")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(mocks.push).toHaveBeenCalledWith("/?team=t1&pending=1");
  });

  it("requires a name before creating", async () => {
    render(<NewProjectDialog teams={teams} defaultTeamId="t2" />);
    const create = screen.getByRole("button", { name: "Create project" });
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Project name"), "   ");
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Project name"), "Website");
    expect(create).toBeEnabled();
    expect(mocks.createProjectAction).not.toHaveBeenCalled();
  });

  it("preselects the team and sends the form values", async () => {
    mocks.createProjectAction.mockResolvedValue({ ok: true, id: "p1" });
    render(<NewProjectDialog teams={teams} defaultTeamId="t2" />);
    expect(screen.getByLabelText("Team")).toHaveValue("t2");
    await userEvent.type(screen.getByLabelText("Project name"), "Website");
    await userEvent.selectOptions(screen.getByLabelText("Priority"), "urgent");
    await userEvent.type(screen.getByLabelText("Due date"), "2026-11-01");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(mocks.createProjectAction).toHaveBeenCalledWith({
      teamId: "t2",
      name: "Website",
      priority: "urgent",
      dueDate: "2026-11-01",
    });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/projects/p1"));
  });

  it("shows the error text from a failed action and stays open", async () => {
    mocks.createProjectAction.mockResolvedValue({ ok: false, error: "Not found" });
    render(<NewProjectDialog teams={teams} defaultTeamId="t1" />);
    await userEvent.type(screen.getByLabelText("Project name"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("ProjectMenu", () => {
  const project = { id: "p1", name: "Website", priority: "normal" as const, dueDate: null, archived: false };

  it("has no delete button anywhere, open or closed", async () => {
    render(<ProjectMenu project={project} />);
    expect(screen.queryByRole("button", { name: /delete|remove/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit project" }));
    expect(screen.getByRole("dialog", { name: "Edit project" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete|remove/i })).not.toBeInTheDocument();
  });

  it("edits name, priority and due date and returns focus to the trigger on close", async () => {
    mocks.updateProjectAction.mockResolvedValue({ ok: true });
    render(<ProjectMenu project={project} />);
    const trigger = screen.getByRole("button", { name: "Edit project" });
    await userEvent.click(trigger);
    const name = screen.getByLabelText("Project name");
    expect(name).toHaveFocus();
    await userEvent.clear(name);
    await userEvent.type(name, "Site");
    await userEvent.selectOptions(screen.getByLabelText("Priority"), "high");
    await userEvent.type(screen.getByLabelText("Due date"), "2026-12-05");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(mocks.updateProjectAction).toHaveBeenCalledWith("p1", { name: "Site", priority: "high", dueDate: "2026-12-05" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("archives, and offers Unarchive for an archived project; shows action errors", async () => {
    mocks.setProjectArchivedAction.mockResolvedValue({ ok: true });
    const { unmount } = render(<ProjectMenu project={project} />);
    await userEvent.click(screen.getByRole("button", { name: "Archive project" }));
    expect(mocks.setProjectArchivedAction).toHaveBeenCalledWith("p1", true);
    unmount();

    mocks.setProjectArchivedAction.mockResolvedValue({ ok: false, error: "Not found" });
    render(<ProjectMenu project={{ ...project, archived: true }} />);
    await userEvent.click(screen.getByRole("button", { name: "Unarchive project" }));
    expect(mocks.setProjectArchivedAction).toHaveBeenLastCalledWith("p1", false);
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
  });
});

describe("Archived filter", () => {
  const zero = { unassigned: 0, assigned: 0, doing: 0, pending: 0, succeeded: 0 };
  const all = [
    { id: "a", state: "active" },
    { id: "b", state: "archived" },
  ];

  it("shows only archived projects when on, only active ones when off", () => {
    expect(filterByArchived(all, true).map((p) => p.id)).toEqual(["b"]);
    expect(filterByArchived(all, false).map((p) => p.id)).toEqual(["a"]);
  });

  it("labels archived projects clearly and offers no Add project row", () => {
    render(
      <TeamCard
        team={{ id: "t1", name: "Design", color: "#7c4dde" }}
        today="2026-10-18"
        archived
        projects={[{ id: "b", name: "Old site", priority: "normal", dueDate: null, counts: zero }]}
      />,
    );
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.queryByText("+ Add project")).not.toBeInTheDocument();
  });

  it("the Add project row keeps the filters and names its team", () => {
    render(
      <TeamCard
        team={{ id: "t1", name: "Design", color: "#7c4dde" }}
        today="2026-10-18"
        newProjectHref="/?team=t1&new=project&forTeam=t1"
        projects={[]}
      />,
    );
    expect(screen.getByRole("link", { name: "+ Add project" })).toHaveAttribute("href", "/?team=t1&new=project&forTeam=t1");
  });
});
