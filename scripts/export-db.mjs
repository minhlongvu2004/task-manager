// Exports every table in the public schema to one JSON file: backups/taskmanager-<timestamp>.json
// Usage: DATABASE_URL=<Railway public Postgres URL> npm run db:export [-- <output-dir>]
// Read-only. The output holds real user data: keep it private and never commit it (backups/ is gitignored).
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const outDir = process.argv[2] ?? process.env.EXPORT_DIR ?? "backups";
const sql = postgres(url, { max: 1 });
try {
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`;
  const dump = { exportedAt: new Date().toISOString(), tables: {} };
  for (const { table_name } of tables) {
    dump.tables[table_name] = await sql`select * from ${sql(table_name)}`;
  }
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `taskmanager-${dump.exportedAt.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(dump, null, 2));
  const rows = Object.values(dump.tables).reduce((n, r) => n + r.length, 0);
  console.log(`Wrote ${file} (${tables.length} tables, ${rows} rows)`);
} catch (err) {
  console.error("Export failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
