# Task Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build version 1 of the Task Manager: Google sign-in, teams as access groups, projects with priority, and tasks with five statuses, deployed on Railway.

**Architecture:** One Next.js app (App Router, server actions) holds the screens and the rules. Pure rule functions (status, owner, sorting, due state) live apart from the database so they are tested alone. A data layer in `src/server/` is the only code that touches PostgreSQL and is the only place access control is enforced.

**Tech Stack:** Next.js (App Router) + TypeScript, Tailwind CSS, PostgreSQL with Drizzle ORM, Auth.js (Google provider), Vitest + React Testing Library, Docker Compose for local Postgres, Railway for hosting. (Stack choices are the author's; the design leaves libraries to the builder.)

**Spec:** `docs/design.md` (same repo). Read it first. Mockups are in `.superpowers/brainstorm/` on the owner's machine only; `interactive-task-panel.html` there is a throwaway prototype of the task panel, not code to reuse.

## Global Constraints

- Task statuses, in order, exactly: `unassigned`, `assigned`, `doing`, `pending`, `succeeded`. Labels: Unassigned, Assigned, Doing, Pending, Succeeded. No other statuses (no Cancelled, Failed, On hold).
- Project priority: `urgent` (label "URGENT", red), `high` ("HIGH", orange), `normal` (no label). Project state: `active` or `archived`.
- Status lives on tasks only. A project has counts, never a status.
- Amber is used only for Pending. Red only for urgent and for due dates within 3 days or overdue. Light theme only.
- A task from Doing onward always has an owner. Pending requires a non-blank stuck reason.
- Deleted tasks are soft-deleted and kept 30 days.
- Due dates are calendar dates (`YYYY-MM-DD`), never timestamps.
- Only the owner's Google account may sign in at first (allowlist).
- Out of scope: roles, permissions beyond team membership, "On hold", templates, subtasks, boards, My tasks, Settings, notifications, dark mode, manual reordering.

## Review Focus

Failure modes the spec implies but a feature task would not otherwise test:

1. A signed-in non-member opens a project or task by its id in the URL: they get "not found", never the data (Task 5, Task 7).
2. A Google account not on the allowlist signs in: friendly "not invited" page and no user row is created (Task 4).
3. Removing a team member who still owns tasks in Doing, Pending or Succeeded: blocked with "Reassign N tasks first" (plan decision, because the spec requires owners from Doing onward) (Task 5).
4. Whitespace-only, empty or very long (over 200 characters) titles; HTML in titles is shown as text, never run (Task 2, Task 7).
5. Due dates near midnight or in another timezone shift by a day: dates are stored and compared as plain `YYYY-MM-DD` strings (Task 2).

## File Structure

```
src/lib/domain/status.ts        status list, labels, order
src/lib/domain/task-rules.ts    setOwner, setStatus, newTaskState (pure)
src/lib/domain/project-view.ts  sortProjects, sortTasks, countsByStatus, dueState (pure)
src/db/schema.ts                Drizzle tables
src/db/client.ts                connection
src/auth.ts                     Auth.js config + allowlist check
src/server/access.ts            SessionUser, visibleTeamIds, assertCanSeeTeam
src/server/teams.ts             teams and members
src/server/projects.ts          projects
src/server/tasks.ts             tasks, trash
src/app/page.tsx                Projects screen
src/app/projects/[id]/page.tsx  Project screen
src/components/...              TeamCard, ProjectRow, StatusTabs, TaskList, TaskPanel, Toast
tests/...                       mirrors src
```

---

### Task 1: Scaffold and tooling

**Files:**
- Create: Next.js app at repo root, `docker-compose.yml`, `vitest.config.ts`, `.env.example`, `drizzle.config.ts`
- Modify: `README.md` (setup steps), `.gitignore` (already ignores `.env*`, `.next/`)
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` runs Vitest; `npm run dev` serves on port 3000; `docker compose up -d db` starts Postgres on port 5433 with databases `taskmanager` and `taskmanager_test`; env vars `DATABASE_URL`, `TEST_DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `OWNER_EMAIL` documented in `.env.example`.

- [ ] **Step 1:** Run `create-next-app` (TypeScript, Tailwind, App Router, `src/` dir, no Turbopack requirement) in a temporary folder and move its files into the repo root, keeping the existing `docs/`, `README.md` and `.gitignore` (merge, do not overwrite).
- [ ] **Step 2:** Add Vitest, React Testing Library, jsdom, Drizzle ORM, drizzle-kit, `postgres`, `next-auth`. Add scripts `test`, `db:generate`, `db:migrate`.
- [ ] **Step 3: Write the failing test** `tests/smoke.test.ts`: `it("runs", () => expect(1 + 1).toBe(2))`. Run `npm test`; expected: PASS once Vitest is configured (FAIL first with "vitest not found" if configured before install).
- [ ] **Step 4:** Add `docker-compose.yml` with Postgres 16 and an init script creating both databases. Run `docker compose up -d db`; verify with `docker compose ps` showing `db` healthy. If Docker is unavailable on the owner's machine, document using two Railway dev databases instead.
- [ ] **Step 5: Commit** `chore: scaffold Next.js app with tests and local database`.

### Task 2: Domain rules (pure, no database)

**Files:**
- Create: `src/lib/domain/status.ts`, `src/lib/domain/task-rules.ts`, `src/lib/domain/project-view.ts`
- Test: `tests/domain/task-rules.test.ts`, `tests/domain/project-view.test.ts`

**Interfaces:**
- Produces:
  - `type TaskStatus = "unassigned" | "assigned" | "doing" | "pending" | "succeeded"`; `STATUS_ORDER: TaskStatus[]`; `STATUS_LABEL: Record<TaskStatus, string>`
  - `type TaskState = { status: TaskStatus; ownerId: string | null; stuckReason: string | null }`
  - `type RuleResult = { ok: true; state: TaskState } | { ok: false; error: string }`
  - `newTaskState(ownerId: string | null): TaskState`
  - `setOwner(state: TaskState, ownerId: string | null): RuleResult`
  - `setStatus(state: TaskState, status: TaskStatus, opts?: { stuckReason?: string }): RuleResult`
  - `validateTitle(raw: string): { ok: true; title: string } | { ok: false; error: string }` (trims; rejects empty and over 200 characters)
  - `type Priority = "urgent" | "high" | "normal"`
  - `sortProjects<T extends { priority: Priority; dueDate: string | null; name: string }>(items: T[]): T[]` (priority, then due date ascending with no date last, then name)
  - `sortTasks<T extends { dueDate: string | null; createdAt: string }>(items: T[]): T[]` (due date ascending with no date last, then created time)
  - `countsByStatus(tasks: { status: TaskStatus }[]): Record<TaskStatus, number>`
  - `dueState(dueDate: string | null, today: string): "none" | "overdue" | "soon" | "later"` (`soon` is 0 to 3 days away)

- [ ] **Step 1: Write failing tests** in `task-rules.test.ts` with these cases and assertions:
  - `newTaskState(null)` is `{status:"unassigned", ownerId:null, stuckReason:null}`; `newTaskState("u1").status` is `"assigned"`.
  - `setOwner` on unassigned with `"u1"` gives status `"assigned"`; on assigned with `null` gives `"unassigned"`; on `doing`, `pending`, `succeeded` with `null` gives `ok:false`.
  - `setStatus(...,"pending")` with no or blank `stuckReason` gives `ok:false`; with `" no API key "` gives `stuckReason:"no API key"`.
  - `setStatus` from pending to `doing` clears `stuckReason`; to `unassigned` clears `ownerId`; to `doing` with `ownerId:null` gives `ok:false`; `succeeded` to `doing` is `ok:true`.
  - `validateTitle("  ")` and a 201-character string give `ok:false`; `"  Fix footer "` gives `"Fix footer"`.
  In `project-view.test.ts`: priority order urgent, high, normal then due date then name; tasks with no date sort last; `countsByStatus([])` returns zeros for all five keys; `dueState("2026-10-18","2026-10-18")` is `"soon"`, `("2026-10-21", same)` is `"soon"`, `("2026-10-22", same)` is `"later"`, `("2026-10-17", same)` is `"overdue"`, `(null, same)` is `"none"`.
- [ ] **Step 2:** Run `npx vitest run tests/domain`; expected FAIL (modules missing).
- [ ] **Step 3:** Implement the functions above as pure code. `dueState` compares `YYYY-MM-DD` strings by converting to UTC day numbers, never `Date` local-time parsing.
- [ ] **Step 4:** Run `npx vitest run tests/domain`; expected PASS.
- [ ] **Step 5: Commit** `feat: pure task, owner and ordering rules`.

### Task 3: Database schema

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, migration files via `npm run db:generate`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: `TaskStatus`, `Priority` from Task 2.
- Produces tables (all ids are `uuid` defaults):
  - `users(id, email unique, name, createdAt)`
  - `workspaces(id, name, ownerUserId)`
  - `allowedEmails(email primary key)`
  - `teams(id, workspaceId, name, color)`
  - `teamMembers(teamId, userId)` primary key on both
  - `projects(id, teamId, name, priority, dueDate text nullable, state)` where `state` is `active | archived`
  - `tasks(id, projectId, title, status, ownerId nullable, dueDate text nullable, stuckReason nullable, createdAt, deletedAt nullable)`
  - `db` (Drizzle client from `DATABASE_URL`, or `TEST_DATABASE_URL` when `NODE_ENV=test`); test helper `resetDb(): Promise<void>` in `tests/db/helpers.ts` that truncates all tables.

- [ ] **Step 1: Write failing test** `schema.test.ts`: after `resetDb()`, insert a workspace, team, project and task, then read the task back; assert `status === "unassigned"`, `deletedAt === null` and `dueDate` is the string passed in (`"2026-11-12"`).
- [ ] **Step 2:** Run `npx vitest run tests/db`; expected FAIL (no tables).
- [ ] **Step 3:** Write the schema and generate and apply migrations to both databases. Add database checks so `status`, `priority` and `state` only accept the allowed values.
- [ ] **Step 4:** Run the test; expected PASS.
- [ ] **Step 5: Commit** `feat: database schema and migrations`.

### Task 4: Sign-in with Google and the allowlist

**Files:**
- Create: `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/signin/page.tsx`, `src/app/not-invited/page.tsx`, `src/server/access.ts`
- Test: `tests/server/access.test.ts`, `tests/server/signin-policy.test.ts`

**Interfaces:**
- Consumes: tables from Task 3.
- Produces:
  - `type SessionUser = { id: string; email: string; isWorkspaceOwner: boolean }`
  - `isEmailAllowed(email: string): Promise<boolean>` (true when email equals `OWNER_EMAIL` or is in `allowedEmails`, case-insensitive)
  - `ensureUserOnSignIn(email: string, name: string | null): Promise<SessionUser | null>` (returns null and creates nothing when not allowed; on the owner's first sign-in creates the user and a workspace)
  - `getSessionUser(): Promise<SessionUser | null>`
  - `visibleTeamIds(user: SessionUser): Promise<string[]>` (all teams in the workspace for the owner; otherwise teams where the user is a member)
  - `assertCanSeeTeam(user: SessionUser, teamId: string): Promise<void>` (throws `NotFoundError` for a non-member)

- [ ] **Step 1: Write failing tests:** allowlist is case-insensitive; a non-allowed email returns null and the `users` table stays empty (Review Focus 2); the owner's first sign-in creates one user and one workspace, and a second sign-in creates no duplicates; `visibleTeamIds` returns every team for the owner and only joined teams for a member; `assertCanSeeTeam` throws for a non-member.
- [ ] **Step 2:** Run `npx vitest run tests/server`; expected FAIL.
- [ ] **Step 3:** Implement the functions and wire Auth.js with the Google provider; use its `signIn` callback to call `ensureUserOnSignIn` and redirect to `/not-invited` when it returns null. Pages other than `/signin` and `/not-invited` require a session.
- [ ] **Step 4:** Run tests; expected PASS. Then run the app and sign in with the owner's Google account once the OAuth credentials exist (instructions in Task 9; use a local callback URL `http://localhost:3000/api/auth/callback/google` for development).
- [ ] **Step 5: Commit** `feat: Google sign-in with allowlist and access checks`.

### Task 5: Data layer with access control

**Files:**
- Create: `src/server/teams.ts`, `src/server/projects.ts`, `src/server/tasks.ts`
- Test: `tests/server/teams.test.ts`, `tests/server/projects.test.ts`, `tests/server/tasks.test.ts`

**Interfaces:**
- Consumes: `SessionUser`, `assertCanSeeTeam`, `visibleTeamIds` (Task 4); rules and validators (Task 2).
- Produces (all take the acting `user` first and throw `NotFoundError` for anything outside their teams):
  - Teams: `listTeams(user)`, `createTeam(user, {name, color})`, `addMemberByEmail(user, teamId, email)` (also adds the email to `allowedEmails`), `removeMember(user, teamId, userId)` (throws `BlockedError("Reassign N tasks first")` when the member owns tasks in doing, pending or succeeded), `deleteTeam(user, teamId)` (throws `BlockedError` when the team has projects)
  - Projects: `listProjects(user, {includeArchived?: boolean})`, `getProject(user, projectId)`, `createProject(user, {teamId, name, priority, dueDate})`, `updateProject(user, projectId, patch)`, `setProjectArchived(user, projectId, archived: boolean)`, `deleteProject(user, projectId)` (moves its tasks to the trash)
  - Tasks: `listTasks(user, projectId, status)` (sorted with `sortTasks`, excludes deleted), `taskCounts(user, projectId)`, `createTask(user, projectId, {title, ownerId, dueDate})`, `updateTask(user, taskId, {title?, ownerId?, status?, dueDate?, stuckReason?})` (all changes go through `setOwner` and `setStatus`; owner must be a member of the project's team), `deleteTask(user, taskId)`, `restoreTask(user, taskId)`, `listTrash(user, projectId)`, `purgeTrash(now: Date): Promise<number>` (permanently removes tasks deleted over 30 days before `now`)

- [ ] **Step 1: Write failing tests** for: a non-member gets `NotFoundError` on `getProject`, `listTasks`, `updateTask` for ids that exist (Review Focus 1); the workspace owner can read every team; `createTask` with no owner starts `unassigned`, with an owner starts `assigned`; `updateTask` to pending without a reason is rejected, with `"no API key"` it saves and leaving pending clears it; a non-member cannot be set as owner; `removeMember` is blocked while the member owns a `doing` task and works after reassigning (Review Focus 3); `deleteTeam` is blocked with projects; archived projects are hidden unless `includeArchived`; deleting then restoring a task returns it unchanged; `purgeTrash` removes a task deleted 31 days earlier and keeps one deleted 29 days earlier; titles are validated (Review Focus 4).
- [ ] **Step 2:** Run `npx vitest run tests/server`; expected FAIL.
- [ ] **Step 3:** Implement against the schema. Every function starts by resolving the project's or task's team and calling `assertCanSeeTeam`; there is no other path to the data.
- [ ] **Step 4:** Run tests; expected PASS.
- [ ] **Step 5: Commit** `feat: teams, projects and tasks data layer with access control`.

### Task 6: Projects screen

**Files:**
- Create: `src/app/page.tsx`, `src/components/TeamCard.tsx`, `src/components/ProjectRow.tsx`, `src/components/Sidebar.tsx`
- Test: `tests/components/team-card.test.tsx`

**Interfaces:**
- Consumes: `listTeams`, `listProjects`, `taskCounts` (Task 5); `sortProjects`, `dueState`, `STATUS_LABEL` (Task 2).
- Produces: `<TeamCard team projects />` and `<ProjectRow project counts today />` where `today` is a `YYYY-MM-DD` string passed in.

- [ ] **Step 1: Write failing tests:** a `TeamCard` renders the team name, "2 projects", and an amber badge "2 pending" only when pending is greater than 0; rows render in priority order; an `urgent` project shows "URGENT", `normal` shows no label; a due date 3 days away and an overdue one carry the red class while a later one does not; the row shows counts for all five statuses.
- [ ] **Step 2:** Run `npx vitest run tests/components`; expected FAIL.
- [ ] **Step 3:** Build the components to match `docs/design.md` (Projects screen): pale team-tint header, solid icon, large team name, thick left edge, indented project rows, "+ Add project" row, "All teams" and "Has Pending" filters, sidebar showing only Projects. Keep the filter state in the URL query.
- [ ] **Step 4:** Run tests; expected PASS. Start the app and check the screen against the mockup visually.
- [ ] **Step 5: Commit** `feat: projects screen`.

### Task 7: Project screen and task panel

**Files:**
- Create: `src/app/projects/[id]/page.tsx`, `src/components/StatusTabs.tsx`, `src/components/TaskList.tsx`, `src/components/TaskPanel.tsx`, `src/components/Toast.tsx`, `src/app/projects/[id]/trash/page.tsx`, `src/app/projects/[id]/actions.ts`
- Test: `tests/components/task-panel.test.tsx`, `tests/components/status-tabs.test.tsx`

**Interfaces:**
- Consumes: Task 5 task functions; Task 2 rules.
- Produces: `<StatusTabs counts active />` (five tabs with a divider before Succeeded, amber Pending count, "+ New task" button), `<TaskPanel mode task members onSubmit onDelete onClose />` where `mode` is `"create" | "edit"`; server actions `createTaskAction`, `updateTaskAction`, `deleteTaskAction`, `restoreTaskAction` wrapping Task 5 and returning `{ok: true} | {ok: false; error: string}`.

- [ ] **Step 1: Write failing tests:** tabs render in order Unassigned, Assigned, Doing, Pending, then Succeeded after a divider, with no "Active" or "All" tab; the page opens on Doing by default; the panel's Save button is disabled for a blank title; choosing Pending shows a required "Why is it stuck?" field and keeps Save disabled until filled; in a Doing task the owner list has no "Nobody" option; choosing an owner on an Unassigned task sets the status to Assigned in the form; a title containing `<img src=x onerror=alert(1)>` renders as text (Review Focus 4); rows show no status text; Pending rows show "Stuck: reason".
- [ ] **Step 2:** Run `npx vitest run tests/components`; expected FAIL.
- [ ] **Step 3:** Implement. The tab is chosen with a `?tab=` query value; the panel opens in a right side column. Delete calls `deleteTaskAction` and shows a toast with Undo (calls `restoreTaskAction`) for about 4 seconds. The Trash page lists `listTrash` with Restore. The panel's behaviour follows the prototype `interactive-task-panel.html`, but written fresh with the real rules.
- [ ] **Step 4:** Run tests; expected PASS. Manually: create a task with no owner, check it is in Unassigned; assign it, check Assigned; move it to Pending with a reason, check the amber count; delete and undo.
- [ ] **Step 5: Commit** `feat: project screen with tabs and task panel`.

### Task 8: Create and manage teams, members and projects

**Files:**
- Create: `src/components/NewTeamDialog.tsx`, `src/components/NewProjectDialog.tsx`, `src/components/MembersPanel.tsx`, `src/components/ProjectMenu.tsx`
- Modify: `src/app/page.tsx` (add "+ New team", "+ New", "+ Add project"), `src/app/projects/[id]/page.tsx` (project menu)
- Test: `tests/components/members-panel.test.tsx`, `tests/components/new-project.test.tsx`

**Interfaces:**
- Consumes: Task 5 team and project functions.
- Produces: dialogs calling `createTeam`, `createProject`, `addMemberByEmail`, `removeMember`, `updateProject`, `setProjectArchived`, `deleteProject` through server actions, each returning `{ok: true} | {ok: false; error: string}` and showing the error text.

- [ ] **Step 1: Write failing tests:** adding a member shows them in the list; removing a member who owns active tasks shows "Reassign 2 tasks first"; creating a project requires a name; an "Archived" filter shows archived projects that are otherwise hidden; deleting a team with projects shows the block message.
- [ ] **Step 2:** Run tests; expected FAIL.
- [ ] **Step 3:** Implement the dialogs and wire them to the screens. Keep forms minimal (name, color, priority, due date, member email).
- [ ] **Step 4:** Run tests; expected PASS.
- [ ] **Step 5: Commit** `feat: create and manage teams, members and projects`.

### Task 9: Deploy to Railway

**Files:**
- Create: `railway.json` (or equivalent), `docs/deploy.md`
- Modify: `package.json` (a `start` script that runs migrations then `next start`), `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a live site on a free Railway address with the owner able to sign in; `purgeTrash` runs daily (Railway cron or a protected route called by a scheduler).

- [ ] **Step 1:** Write `docs/deploy.md` with owner-friendly steps: create the Railway project, add PostgreSQL, set the six env vars, and create the Google OAuth credential (Google Cloud Console, OAuth consent screen, Web client, authorized redirect `https://<railway-address>/api/auth/callback/google`).
- [ ] **Step 2:** Add the start script and a protected `/api/cron/purge` route that checks a `CRON_SECRET` and calls `purgeTrash(new Date())`; test it returns 401 without the secret and a count with it.
- [ ] **Step 3:** Check whether the Railway plan includes database backups. If it does not, add a documented daily export.
- [ ] **Step 4:** Deploy. Verify: the site loads, signing in with the owner's account works, an unlisted Google account lands on "not invited", and creating a team, project and task persists after a redeploy.
- [ ] **Step 5: Commit** `chore: Railway deployment`. Later (not in this plan): attach the owner's new domain and add the Resend email sign-in.
