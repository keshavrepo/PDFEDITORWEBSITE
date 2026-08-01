import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __pdfPilotPostgresqlPool?: Pool;
};

/**
 * Creating a pg Pool does not open a connection. Keeping construction lazy in
 * this way allows `next build` and public pages to run without touching the
 * database, while health checks and database-backed features still fail fast
 * with a useful error when DATABASE_URL is missing.
 */
export const pool =
  globalForDb.__pdfPilotPostgresqlPool ??
  new Pool(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : undefined
  );

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pdfPilotPostgresqlPool = pool;
}

export const db = drizzle(pool);

export function assertDatabaseConfigured(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
}
