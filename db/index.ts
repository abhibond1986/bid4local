import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Lazy database connection.
 *
 * We intentionally do NOT throw at module load if DATABASE_URL is missing.
 * `next build` imports server modules (e.g. admin pages → server actions →
 * this file) while collecting page data, at which point env vars for the
 * runtime database are not necessarily present. Throwing here would fail the
 * build even though no query is executed. Instead we defer the check to the
 * first actual query, so a missing DATABASE_URL surfaces at request time.
 */
const globalForDb = globalThis as typeof globalThis & {
  __bid4localPool?: Pool;
  __bid4localDb?: ReturnType<typeof drizzle>;
};

function getPool(): Pool {
  if (globalForDb.__bid4localPool) return globalForDb.__bid4localPool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to the database");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__bid4localPool = pool;
  }
  return pool;
}

// `pool` is a lazy proxy: constructing/importing it is free; the real Pool is
// created (and DATABASE_URL validated) only when a property is first accessed.
export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    return Reflect.get(getPool(), prop, receiver);
  },
}) as Pool;

// Same lazy strategy for the drizzle instance.
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, receiver) {
    if (!globalForDb.__bid4localDb) {
      globalForDb.__bid4localDb = drizzle(getPool());
    }
    return Reflect.get(globalForDb.__bid4localDb, prop, receiver);
  },
}) as ReturnType<typeof drizzle>;
