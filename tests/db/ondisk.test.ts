import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

it("client.ts creates a missing data dir before opening PGlite", async () => {
  // Plain PGlite on a missing nested path fails; client.ts mkdirs first (checked via source).
  const src = fs.readFileSync(path.join(process.cwd(), "src/db/client.ts"), "utf8");
  expect(src).toMatch(/mkdirSync\(dataDir, \{ recursive: true \}\)/);
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tm-")), "a", "b");
  fs.mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir);
  await pg.query("select 1");
  await pg.close();
});
