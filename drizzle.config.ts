import { defineConfig } from "drizzle-kit";

// Migrations are applied by db/migrate.ts (which handles the PGlite <-> Postgres switch);
// drizzle-kit is used for generation only, so no credentials are needed here.
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
});
