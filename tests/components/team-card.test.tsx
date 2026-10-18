import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TeamCard, type TeamCardProject } from "@/components/TeamCard";
import { ProjectRow } from "@/components/ProjectRow";

const TODAY = "2026-10-18";
const zero = { unassigned: 0, assigned: 0, doing: 0, pending: 0, succeeded: 0 };
const team = { id: "t1", name: "Design Team", color: "#7c4dde" };

function proj(over: Partial<TeamCardProject> & { id: string; name: string }): TeamCardProject {
  return { priority: "normal", dueDate: null, counts: zero, ...over };
}

describe("TeamCard", () => {
  it("shows the team name, project count and an amber pending badge", () => {
    render(
      <TeamCard
        team={team}
        today={TODAY}
        projects={[
          proj({ id: "a", name: "Alpha", counts: { ...zero, pending: 1 } }),
          proj({ id: "b", name: "Beta", counts: { ...zero, pending: 1 } }),
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Design Team" })).toBeInTheDocument();
    expect(screen.getByText(/2 projects/)).toBeInTheDocument();
    const badge = screen.getByText("2 pending");
    expect(badge.className).toMatch(/amber/);
  });

  it("omits the badge when nothing is pending, and uses singular project", () => {
    render(<TeamCard team={team} today={TODAY} projects={[proj({ id: "a", name: "Alpha" })]} />);
    expect(screen.queryByText(/ pending$/)).not.toBeInTheDocument();
    expect(screen.getByText(/1 project\b/)).toBeInTheDocument();
  });

  it("renders rows in the order given and links the add-project row", () => {
    render(
      <TeamCard
        team={team}
        today={TODAY}
        projects={[proj({ id: "a", name: "First" }), proj({ id: "b", name: "Second" })]}
      />,
    );
    const rows = screen.getAllByRole("link", { name: /First|Second/ });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("First");
    expect(rows[1]).toHaveTextContent("Second");
    expect(screen.getByRole("link", { name: "+ Add project" })).toHaveAttribute("href", "?new=project");
  });

  it("renders team and project names as text, not HTML", () => {
    render(
      <TeamCard
        team={{ ...team, name: "<b>Evil</b>" }}
        today={TODAY}
        projects={[proj({ id: "a", name: "<i>x</i>" })]}
      />,
    );
    expect(screen.getByText("<b>Evil</b>")).toBeInTheDocument();
    expect(screen.getByText("<i>x</i>")).toBeInTheDocument();
  });
});

describe("ProjectRow", () => {
  const base = { id: "p1", name: "Site", priority: "normal" as const, dueDate: null };

  it("links to the project", () => {
    render(<ProjectRow project={base} counts={zero} today={TODAY} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/projects/p1");
  });

  it("labels urgent and high, and shows nothing for normal", () => {
    const { rerender } = render(<ProjectRow project={{ ...base, priority: "urgent" }} counts={zero} today={TODAY} />);
    expect(screen.getByText("URGENT").className).toMatch(/red/);
    rerender(<ProjectRow project={{ ...base, priority: "high" }} counts={zero} today={TODAY} />);
    expect(screen.getByText("HIGH").className).toMatch(/orange/);
    expect(screen.queryByText("URGENT")).not.toBeInTheDocument();
    rerender(<ProjectRow project={base} counts={zero} today={TODAY} />);
    expect(screen.queryByText("URGENT")).not.toBeInTheDocument();
    expect(screen.queryByText("HIGH")).not.toBeInTheDocument();
    expect(screen.queryByText(/normal/i)).not.toBeInTheDocument();
  });

  it("turns the due date red when 3 days away or overdue, not when later or missing", () => {
    const cases: [string, boolean][] = [
      ["2026-10-21", true],
      ["2026-10-01", true],
      ["2026-10-22", false],
    ];
    for (const [dueDate, red] of cases) {
      const { unmount } = render(<ProjectRow project={{ ...base, dueDate }} counts={zero} today={TODAY} />);
      const el = screen.getByTestId("due");
      if (red) expect(el.className).toMatch(/red/);
      else expect(el.className).not.toMatch(/red/);
      unmount();
    }
    render(<ProjectRow project={base} counts={zero} today={TODAY} />);
    expect(screen.getByTestId("due").className).not.toMatch(/red/);
  });

  it("formats the due date without timezone drift", () => {
    render(<ProjectRow project={{ ...base, dueDate: "2026-11-12" }} counts={zero} today={TODAY} />);
    expect(screen.getByTestId("due")).toHaveTextContent("Nov 12");
  });

  it("shows counts for all five statuses, pending in amber only", () => {
    const counts = { unassigned: 1, assigned: 2, doing: 3, pending: 4, succeeded: 5 };
    render(<ProjectRow project={base} counts={counts} today={TODAY} />);
    const row = screen.getByRole("link");
    for (const t of ["1 Unassigned", "2 Assigned", "3 Doing", "4 Pending", "5 Succeeded"]) {
      expect(within(row).getByText(t)).toBeInTheDocument();
    }
    expect(within(row).getByText("4 Pending").className).toMatch(/amber/);
    expect(within(row).getByText("3 Doing").className).not.toMatch(/amber/);
  });
});
