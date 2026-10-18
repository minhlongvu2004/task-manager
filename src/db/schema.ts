import { sql } from "drizzle-orm";
import { check, index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { STATUS_ORDER, type TaskStatus } from "@/lib/domain/status";
import type { Priority } from "@/lib/domain/project-view";

// Keep in sync with the Priority type (the `satisfies` fails to compile if a value is not a Priority).
export const PRIORITIES = ["urgent", "high", "normal"] as const satisfies readonly Priority[];
export const PROJECT_STATES = ["active", "archived"] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(", ")})`);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
});

export const allowedEmails = pgTable("allowed_emails", {
  email: text("email").primaryKey(),
});

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
  },
  (t) => [index("teams_workspace_id_idx").on(t.workspaceId)],
);

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    index("team_members_user_id_idx").on(t.userId),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priority: text("priority").$type<Priority>().notNull().default("normal"),
    dueDate: text("due_date"), // YYYY-MM-DD, never a timestamp
    state: text("state").$type<ProjectState>().notNull().default("active"),
  },
  (t) => [
    index("projects_team_id_idx").on(t.teamId),
    check("projects_priority_check", inList("priority", PRIORITIES)),
    check("projects_state_check", inList("state", PROJECT_STATES)),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").$type<TaskStatus>().notNull().default("unassigned"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    dueDate: text("due_date"), // YYYY-MM-DD, never a timestamp
    stuckReason: text("stuck_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("tasks_status_check", inList("status", STATUS_ORDER)),
    index("tasks_project_id_idx").on(t.projectId).where(sql`deleted_at is null`),
    index("tasks_owner_id_idx").on(t.ownerId),
  ],
);

// Auth.js email sign-in links. Only a hash of the token is stored; rows are deleted when used.
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
