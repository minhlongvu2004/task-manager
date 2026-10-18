// Applies database migrations before the server starts (`npm start` runs this first).
// Plain Node, no TypeScript and no dev dependencies: only `postgres` and `drizzle-orm`, which are
// production dependencies. It reads the same ./drizzle folder that ensureMigrated() in
// src/db/client.ts uses, so there is one set of migrations and two thin entry points.
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set; refusing to start without a database.");
  process.exit(1);
}

// max: 1 keeps the migration on a single connection.
const client = postgres(url, { max: 1 });
try {
  await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("Migrations applied.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exitCode = 1;
} finally {
  await client.end();
}
