import fs from "node:fs";
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
const migrationsFolder = () => path.join(process.cwd(), "drizzle");

function create() {
  const url = process.env.DATABASE_URL;
  // Fail fast: a production server without a database URL must not quietly fall back to PGlite.
  // This runs at first use (not import) so `next build` works without a database.
  if (!url && process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is not set. It is required when NODE_ENV=production.");
  }
  if (url) {
    const db = drizzlePg(postgres(url), { schema });
    return { db, migrate: () => migratePg(db, { migrationsFolder: migrationsFolder() }) };
  }
  const dataDir = process.env.NODE_ENV === "test" ? undefined : ".data/dev";
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const db = drizzlePglite(new PGlite(dataDir), { schema });
  return { db, migrate: () => migratePglite(db, { migrationsFolder: migrationsFolder() }) };
}

// Cached on globalThis so Next dev hot reloads do not open a second PGlite on the same directory.
// Created lazily on first use, so importing this module never opens a connection or throws.
type Instance = ReturnType<typeof create> & { ready?: Promise<void> };
const g = globalThis as unknown as { __tm?: Instance };
const getInstance = (): Instance => (g.__tm ??= create());

// Typed as the Postgres driver. PGlite is cast to that type: the query API is identical and only
// the `$client` property differs. A proxy defers creating the client until it is first used.
// Prefer getDb(), which guarantees migrations have run.
export const db = new Proxy({} as object, {
  get(_t, prop) {
    const real = getInstance().db as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === "function" ? v.bind(real) : v;
  },
}) as ReturnType<typeof drizzlePg<typeof schema>>;

/**
 * Applies pending migrations; runs once per process. A failed run is not cached, so the next call
 * retries. In production, scripts/migrate.mjs applies the same ./drizzle folder before the server starts.
 */
export async function ensureMigrated(): Promise<void> {
  const instance = getInstance();
  instance.ready ??= instance.migrate().catch((err) => {
    instance.ready = undefined;
    throw err;
  });
  return instance.ready;
}

/** The safe entry point for app code: migrates first, then returns the client. */
export async function getDb() {
  await ensureMigrated();
  return db;
}
