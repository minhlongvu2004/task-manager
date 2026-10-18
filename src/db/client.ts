import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema";

/*
 * Driver choice:
 *  - DATABASE_URL set      -> postgres-js against real Postgres
 *  - NODE_ENV=test         -> in-memory PGlite. Module state is per test file in Vitest, so each
 *                             file gets its own fresh DB, shared by all tests in that file; call
 *                             resetDb() (tests/db/helpers.ts) in beforeEach to empty the tables.
 *  - otherwise             -> PGlite persisted in .data/dev
 * Both drivers are migrated from ./drizzle by ensureMigrated() (once per process).
 */
const migrationsFolder = path.join(process.cwd(), "drizzle");

function create() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const db = drizzlePg(postgres(url), { schema });
    return { db, migrate: () => migratePg(db, { migrationsFolder }) };
  }
  const dataDir = process.env.NODE_ENV === "test" ? undefined : ".data/dev";
  const db = drizzlePglite(new PGlite(dataDir), { schema });
  return { db, migrate: () => migratePglite(db, { migrationsFolder }) };
}

// Cached on globalThis so Next dev hot reloads do not open a second PGlite on the same directory.
type Instance = ReturnType<typeof create> & { ready?: Promise<void> };
const g = globalThis as unknown as { __tm?: Instance };
const instance: Instance = (g.__tm ??= create());

// Typed as the Postgres driver; PGlite exposes the same query API.
export const db = instance.db as unknown as ReturnType<typeof drizzlePg<typeof schema>>;

/** Applies pending migrations; safe to call repeatedly (runs once). */
export function ensureMigrated(): Promise<void> {
  return (instance.ready ??= instance.migrate());
}
