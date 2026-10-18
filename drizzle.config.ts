import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Unset locally: drizzle-kit migrations are applied to PGlite in code (.data/).
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
