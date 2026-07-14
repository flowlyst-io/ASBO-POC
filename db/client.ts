import * as schema from "./schema";

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/**
 * Database client with an env-based driver switch:
 *  - DATABASE_URL set   -> node-postgres (Neon / any Postgres)
 *  - DATABASE_URL unset -> embedded PGlite at ./.data/pg (zero-setup local dev)
 *
 * Both are the Postgres dialect, so db/schema.ts and all queries are identical.
 */

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let dbPromise: Promise<Db> | null = null;

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url && url.length > 0) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    return drizzle(pool, { schema });
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("fs");
  mkdirSync("./.data/pg", { recursive: true }); // PGlite won't create parents
  const pglite = new PGlite("./.data/pg");
  return drizzle(pglite, { schema });
}

/** Get the singleton database client (lazily initialized). */
export function getDb(): Promise<Db> {
  if (!dbPromise) dbPromise = createDb();
  return dbPromise;
}

export { schema };
