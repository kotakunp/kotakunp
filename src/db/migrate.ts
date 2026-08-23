import path from "node:path";
import process from "node:process";
import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getContentDatabasePath, openContentDatabase } from "./client";

export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

export function countAppliedMigrations(sqlite: Database.Database): number {
  const tableExists = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
    )
    .get();
  if (!tableExists) return 0;
  const row = sqlite.prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations").get() as
    | { count: number }
    | undefined;
  return row?.count ?? 0;
}

/** Applies pending migrations and returns how many were applied in this call. */
export function applyMigrations(
  sqlite: Database.Database,
  migrationsFolder: string = MIGRATIONS_FOLDER,
): number {
  const before = countAppliedMigrations(sqlite);
  migrate(drizzle(sqlite), { migrationsFolder });
  return countAppliedMigrations(sqlite) - before;
}

/**
 * Provisioning entry point used by `npm run db:migrate`. Unlike the runtime
 * client, it is allowed to create the database file (inside its parent dir).
 */
export function migrateContentDatabaseFromEnvironment(): {
  applied: number;
  totalApplied: number;
  databasePath: string;
} {
  const databasePath = getContentDatabasePath();
  const sqlite = openContentDatabase(databasePath, { allowCreate: true });
  try {
    const applied = applyMigrations(sqlite);
    return { applied, totalApplied: countAppliedMigrations(sqlite), databasePath };
  } finally {
    sqlite.close();
  }
}
