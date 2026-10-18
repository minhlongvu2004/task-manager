import { afterEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

afterEach(() => vi.restoreAllMocks());

describe("client", () => {
  it("getDb() returns a migrated db", async () => {
    const { getDb } = await import("@/db/client");
    const db = await getDb();
    const r = (await db.execute(sql`select count(*)::int as n from tasks`)) as unknown as { rows: unknown[] };
    expect(r.rows[0]).toEqual({ n: 0 });
  }, 30_000);

  it("does not cache a failed migration; the next call retries", async () => {
    vi.resetModules();
    delete (globalThis as { __tm?: unknown }).__tm; // fresh, un-migrated instance
    const cwd = process.cwd();
    const spy = vi.spyOn(process, "cwd").mockReturnValue("/nonexistent-dir");
    const mod = await import("@/db/client");
    await expect(mod.ensureMigrated()).rejects.toThrow();
    spy.mockReturnValue(cwd);
    await expect(mod.ensureMigrated()).resolves.toBeUndefined();
  }, 30_000);
});
