import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsFolder = path.join(projectRoot, "drizzle");
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

const pool = new pg.Pool({ connectionString, max: 1 });

function describeError(error) {
  const messages = [];
  const seen = new Set();
  let current = error;

  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error && current.message) messages.push(current.message);
    current = typeof current === "object" ? current.cause : undefined;
  }

  return [...new Set(messages)].join("\nCaused by: ") || String(error);
}

async function main() {
  const migrationFiles = readMigrationFiles({ migrationsFolder });
  if (migrationFiles.length === 0) {
    throw new Error(`No migration files were found in ${migrationsFolder}`);
  }

  const database = drizzle(pool);
  await migrate(database, { migrationsFolder });

  const result = await pool.query(
    'select hash from "drizzle"."__drizzle_migrations"'
  );
  const appliedHashes = new Set(result.rows.map((row) => row.hash));
  const missingMigrations = migrationFiles.filter(
    (migration) => !appliedHashes.has(migration.hash)
  );

  if (missingMigrations.length > 0) {
    throw new Error(
      `${missingMigrations.length} migration(s) were not applied. ` +
        "The Drizzle migration journal is out of sync with the database."
    );
  }

  console.log(`Applied ${migrationFiles.length} migration file(s) successfully.`);
}

try {
  await main();
} catch (error) {
  console.error("Database migration failed:");
  console.error(describeError(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
