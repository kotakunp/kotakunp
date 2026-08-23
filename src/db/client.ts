import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

export const DEFAULT_DATABASE_PATH = "./data/content.sqlite";
export const DEFAULT_UPLOADS_PATH = "./data/uploads";

const BUSY_TIMEOUT_MS = 5000;

const absolutePathCache = new Map<string, string>();

function resolveConfiguredPath(rawPath: string): string {
  const cached = absolutePathCache.get(rawPath);
  if (cached) return cached;
  const resolved = path.resolve(rawPath);
  absolutePathCache.set(rawPath, resolved);
  return resolved;
}

export function getContentDatabasePath(): string {
  return resolveConfiguredPath(
    process.env.CONTENT_DATABASE_PATH ?? DEFAULT_DATABASE_PATH,
  );
}

export function getContentUploadsPath(): string {
  return resolveConfiguredPath(
    process.env.CONTENT_UPLOADS_PATH ?? DEFAULT_UPLOADS_PATH,
  );
}

export function ensureParentDirectory(targetPath: string): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
}

export type OpenContentDatabaseOptions = {
  /**
   * Provisioning paths (the migrate script) may create the database file.
   * Runtime reads/writes must not: a misspelled production path would otherwise
   * boot an empty database instead of failing loudly.
   */
  allowCreate?: boolean;
};

export function openContentDatabase(
  dbPath: string,
  options: OpenContentDatabaseOptions = {},
): Database.Database {
  const { allowCreate = false } = options;
  if (!fs.existsSync(dbPath)) {
    if (!allowCreate) {
      throw new Error(
        `Content database not found at ${dbPath}. Run \`npm run db:migrate\` to create and migrate it before starting the app.`,
      );
    }
    ensureParentDirectory(dbPath);
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  return sqlite;
}

type GlobalWithContentDb = typeof globalThis & {
  __kotakunpContentDb?: {
    sqlite: Database.Database;
    db: Db;
  };
};

const globalStore = globalThis as GlobalWithContentDb;

function getSingleton(): { sqlite: Database.Database; db: Db } {
  if (!globalStore.__kotakunpContentDb) {
    const sqlite = openContentDatabase(getContentDatabasePath());
    globalStore.__kotakunpContentDb = { sqlite, db: drizzle(sqlite, { schema }) };
  }
  return globalStore.__kotakunpContentDb;
}

/** Raw better-sqlite3 handle for the configured content database (singleton). */
export function getSqliteHandle(): Database.Database {
  return getSingleton().sqlite;
}

/** Drizzle instance bound to the configured content database (singleton). */
export function getDb(): Db {
  return getSingleton().db;
}

export function closeContentDatabase(): void {
  globalStore.__kotakunpContentDb?.sqlite.close();
  globalStore.__kotakunpContentDb = undefined;
}
