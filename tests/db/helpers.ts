import { sql } from "drizzle-orm";
import { db, ensureMigrated } from "@/db/client";

/** Applies migrations (once per module instance) and empties every table. */
export async function resetDb(): Promise<void> {
  await ensureMigrated();
  await db.execute(sql`
    TRUNCATE TABLE tasks, projects, team_members, teams, allowed_emails, workspaces, users
    RESTART IDENTITY CASCADE
  `);
}
