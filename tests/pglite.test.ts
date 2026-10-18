import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { expect, it } from "vitest";

it("Drizzle's PGlite driver runs select 1", async () => {
  const client = new PGlite();
  const db = drizzle(client);
  const result = await db.execute(sql`select 1 as one`);
  expect(result.rows[0]).toEqual({ one: 1 });
  await client.close();
});
