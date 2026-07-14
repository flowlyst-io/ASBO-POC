/**
 * Applies drizzle migrations against whichever driver is active
 * (PGlite locally, node-postgres when DATABASE_URL is set).
 *
 * Run: npm run db:migrate
 */

async function main() {
  const url = process.env.DATABASE_URL;
  if (url && url.length > 0) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./db/migrations" });
    await pool.end();
    console.log("Migrations applied (postgres).");
  } else {
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const { PGlite } = await import("@electric-sql/pglite");
    const { mkdirSync } = await import("fs");
    mkdirSync("./.data/pg", { recursive: true }); // PGlite won't create parents
    const pglite = new PGlite("./.data/pg");
    const db = drizzle(pglite);
    await migrate(db, { migrationsFolder: "./db/migrations" });
    await pglite.close();
    console.log("Migrations applied (embedded PGlite at ./.data/pg).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
