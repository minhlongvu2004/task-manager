# Task Manager: Design

Date: 2026-10-18. Status: draft for the owner's approval.

## Intent and why

A simple, professional task manager. The owner (Minh) looked at Jira and found it too complicated, and surveyed current tools (Linear, Height, Shortcut, Plane). The direction is Linear's speed and clean feel, plus a few things Jira does well (grouping work under projects and teams), without the setup and configuration.

It is a personal project, used by the owner first. Other people may use it later, so nothing should need rewriting to let them in, but nothing for them is built in version 1.

## Goals

- Fast and clean. Opening a project and adding or moving a task takes seconds.
- Work is grouped team, then project, then task.
- Show at a glance which projects matter most (priority labels) and where work is stuck (Pending).
- Login from day one, so other people can be added later.

## Non-goals (not in version 1)

- Roles and permissions, billing, an admin area.
- Templates, subtasks, an inbox of tasks without a project.
- An "On hold" state for a whole project. Archiving covers a paused project.
- A board (drag between columns). Possible later as a second view.
- Time tracking, advanced reports, notifications.

## Anti-goals (a failure even if it technically works)

- Configuration screens, custom fields or custom workflows. If it starts to feel like Jira, it has failed.
- Colors that compete. Color belongs to the project header and to the amber Pending marker only.
- The same information shown twice on one screen (for example a status on every row under a status header).

## Concepts and data

Structure: Workspace, then Team, then Project, then Task. A user belongs to teams and can be the owner of tasks.

- **Workspace.** The top container. Today there is one, the owner's. It exists so other people can be added later. (Builder's call to confirm: the owner proposed no such layer; it was suggested for future growth.)
- **Team.** A named, colored group, like a group in an operating system. People are added to or removed from a team at any time. Being in a team means you can see all of its projects and their tasks; people outside the team cannot see them. Team members have no roles and no extra permissions.
- **Project.** Belongs to one team. Has a name, a priority (Urgent, High or Normal), a due date, and a state (Active or Archived). It has no status of its own. Its row shows task counts per status.
- **Task.** Belongs to one project. Has a title, a status, an optional owner, an optional due date, and, only when Pending, a stuck reason.
- **Trash.** Deleted tasks go to a trash and can be restored for a while. There is no Cancelled or Failed status.

### Task statuses

In order: **Unassigned, Assigned, Doing, Pending, Succeeded.**

- Unassigned: no one owns it. Where new tasks start.
- Assigned: someone owns it, not started.
- Doing: in progress.
- Pending: started, got stuck, set aside to come back to. A short stuck reason is required.
- Succeeded: finished.

### Owner and status rules

- Choosing an owner for an Unassigned task moves it to Assigned. Removing the owner from an Assigned task moves it back to Unassigned.
- From Doing onward, a task always has an owner. The owner can be changed but not removed.
- Moving a task to Pending requires a stuck reason.
- A new task created with no owner starts in Unassigned. Created with an owner, it starts in Assigned.

## Screens

Mockups were reviewed in the browser and the final choices are recorded here. Saved mockups are in `.superpowers/brainstorm/` and the data diagram is the artifact at https://claude.ai/artifact/2wE4h5uoRyU48YCbvZU1CP.

### Projects screen (the home screen)

- Left sidebar (mockup showed Projects, My tasks, Teams, Settings; version 1 keeps only Projects, see the calls below). Top bar: title, an "All teams" filter, a "Has Pending" filter, and "+ New" (project).
- Each team is a card. The header has a pale tint of the team color, a solid colored icon, the team name in large bold type, a summary line (projects, people) and an amber badge with the number of Pending tasks when there are any. The card has a thick left edge in the team color.
- Inside the card, projects are compact rows under a thin vertical line, with "+ Add project" at the end.
- A project row: name with a priority label (red URGENT or orange HIGH; Normal shows nothing), people avatars, counts per status (the Pending count is amber), and a due date that turns red when close.
- Within a team, projects sort by priority, then in the owner's order. (Assumed, not confirmed.)
- Keyboard hints: arrow keys to move, Enter to open, N for new project.

### Project screen (opens from a project row)

- A strong project header: pale team tint, large project name, priority label, then team, due date and task count.
- Status tabs under the header, in order: Unassigned, Assigned, Doing, Pending, a thin divider, Succeeded. Each tab shows its count; the Pending count is amber. No extra "Active" or "All" tab.
- The screen opens on the Doing tab. (Assumed, not confirmed.)
- A single flat list of tasks for the selected tab. Rows show title, owner avatar (or a dashed "+ assign" when none) and due date. Status is not repeated on rows. Pending rows show "Stuck: reason".
- "+ New task" button at the right end of the tab bar, the same on every tab.
- Clicking a task or "+ New task" opens a side panel on the right. The same panel creates and edits. Fields: title (required), status (when editing), owner, due date, stuck reason (only when status is Pending and then required), Delete (moves to trash with Undo). Owner and status follow the rules above, including hiding "Nobody" from Doing onward.
- A working prototype of this panel exists at `.superpowers/brainstorm/1718-1792324880/content/interactive-task-panel.html`. It is throwaway and not product code.

### Style

Light theme only for version 1. Clean, compact, white and pale-tint surfaces, soft borders. Amber is reserved for Pending, red for urgent and overdue. No dark mode, no heavy colored bands. Final visual polish is left to the builder within these rules.

## Architecture and choices

Recorded at https://claude.ai/artifact/8ojG2yUjbdsG3x7t92Q17R. Summary: a web app with three parts (the screens, the rules, the database) behind a login. All tools below are the author's choices (the owner has not yet confirmed them all, and their coding background is unknown), so the builder may adjust them if there is a clear reason.

- **Screens and rules:** React with TypeScript in Next.js, one project.
- **Data:** PostgreSQL.
- **Hosting:** Railway, running the app and the database together. The owner said "I might go with Railway". The estimated cost is about $5 a month, billed by usage, from third-party pricing pages that disagree in places. Cost comparison: https://claude.ai/artifact/JtNRtibd7KkjAYVnFEdxSr.
- **Login:** Sign in with Google for version 1 (author's choice, not yet confirmed). Email sign-in links through Resend can be added later. Resend needs a verified sending domain.
- **Domain:** The owner owns `minhlongvu.com` (used by a portfolio site, which must not be touched) and said they plan to buy a new domain for this product, then said a subdomain of their existing domain is acceptable. This is undecided. Version 1 is built and tested on a free Railway address, so the domain is only needed at the end. Explainer for the owner: https://claude.ai/artifact/8VrAZs7YrmbUsgXjaxxXNC.
- Where possible, keep the data model matching this document so that adding other people later needs no rewrite.

## Decisions to confirm

Marked above as assumed or the author's choice:
1. (Settled by the owner) A team is a group: membership gives access to all its projects. No team roles.
2. Workspace layer exists from day one.
3. Projects sort by priority within a team.
4. The project screen opens on the Doing tab.
5. Sign in with Google first, email links later.
6. The tool stack and Railway.
7. Which domain to use, and when.

## Calls made after the builder check (author's calls, change any of them)

- **Who can sign in:** an allowlist of Google accounts. Version 1 allows only the owner's account, so a public Railway address cannot be used by strangers. The owner adds and removes people on the People page; being on the list gives no access to any team.
- **Sidebar in version 1:** only Projects. "My tasks", "Teams" and "Settings" are left out. Teams are created with a "+ New team" action on the Projects screen (name and color). Members are added by email, and only people already on the invited list can be added. Teams are private to their members; the owner has no special view into other people's teams.
- **Owner picker:** lists the members of the project's team.
- **Who sees what:** the workspace owner sees every team. Everyone else sees only the teams they belong to. Anyone in a team can create and edit projects and tasks in it.
- **Ordering:** projects sort by priority, then by due date. Tasks in a tab sort by due date (no date last), then by creation time. No manual reordering in version 1.
- **Project actions:** edit name, priority and due date; archive and unarchive; no delete in version 1 (archiving covers it). Archived projects are hidden from the Projects screen and from counts, and shown under an "Archived" filter. Deleting a team is only allowed when it has no projects.
- **Removing a team member:** their Assigned tasks return to Unassigned; if they own Doing or Pending tasks, removal is blocked until those are reassigned; their Succeeded tasks keep them as owner.
- **Team creator:** whoever creates a team is automatically a member of it.
- **Task transitions:** any status can move to any other, except that the owner rules above still apply. Moving back to Unassigned clears the owner. The stuck reason is cleared when a task leaves Pending. A Succeeded task can be reopened by moving it to Doing.
- **Trash:** a small "Trash" link on the project screen lists deleted tasks with Restore. Items stay 30 days. The Undo after deleting is a toast only.
- **"Close" due date:** within 3 days, or overdue, shows red.
- **Backups:** use Railway's database backups if the plan has them, and otherwise a daily export. To be checked at build time.
- **Google sign-in setup:** the owner creates a Google Cloud OAuth credential. The builder gives step-by-step instructions.

## Left to the builder

- Database schema details, API shape, folder structure and testing approach.
- How long deleted tasks stay in the trash.
- Exact spacing, type and color values within the style rules above.
- Mobile and small-screen behavior (the layouts should degrade sensibly; no separate phone design was made).
- The order of building (a sensible first slice is: login, projects screen, project screen with the task panel).
