import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Database connection.
 *
 * We do NOT throw at module load when DATABASE_URL is missing. `next build`
 * imports server modules (admin pages → auth.ts → DrizzleAdapter(db)) while
 * collecting page data, and Auth.js inspects the drizzle instance to detect
 * the driver. It must therefore receive a REAL drizzle object (not a Proxy),
 * so we construct it eagerly. The pg Pool does not open a connection at
 * construction — it connects lazily on the first query — so a missing
 * DATABASE_URL only surfaces when a query actually runs, not at build time.
 */
const globalForDb = globalThis as typeof globalThis & {
  __bid4localPool?: Pool;
};

export const pool =
  globalForDb.__bid4localPool ??
  new Pool({
    // May be undefined at build time; pg only errors on first connect.
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__bid4localPool = pool;
}

export const db = drizzle(pool);
