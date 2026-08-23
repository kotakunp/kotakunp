import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeContentDatabase,
  getDb,
  getSqliteHandle,
  openContentDatabase,
} from "@/db/client";
import {
  applyMigrations,
  countAppliedMigrations,
  MIGRATIONS_FOLDER,
} from "@/db/migrate";

const EXPECTED_TABLES = [
  "media",
  "journal_posts",
  "tags",
  "journal_post_tags",
  "journal_post_media",
  "music_releases",
  "music_tracks",
];

function listTables(sqlite: ReturnType<typeof getSqliteHandle>): string[] {
  return sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((row) => (row as { name: string }).name);
}

describe("content database foundation", () => {
  let tempDir: string;
  let dbPath: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kotakunp-plan010-"));
    dbPath = path.join(tempDir, "content.sqlite");
    process.env.CONTENT_DATABASE_PATH = dbPath;
  });

  afterAll(() => {
    closeContentDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("refuses to silently create a database at runtime", () => {
    process.env.CONTENT_DATABASE_PATH = path.join(tempDir, "missing.sqlite");
    expect(() => getDb()).toThrow(/npm run db:migrate/);
    expect(fs.existsSync(path.join(tempDir, "missing.sqlite"))).toBe(false);
    process.env.CONTENT_DATABASE_PATH = dbPath;
  });

  it("applies the structural migration once and is idempotent", () => {
    // Provisioning path (npm run db:migrate): creation is allowed here.
    const sqlite = openContentDatabase(dbPath, { allowCreate: true });
    try {
      const firstRun = applyMigrations(sqlite, MIGRATIONS_FOLDER);
      expect(firstRun).toBeGreaterThanOrEqual(1);

      const tables = listTables(sqlite);
      for (const table of EXPECTED_TABLES) {
        expect(tables, `expected table ${table}`).toContain(table);
      }

      // Second application must not duplicate anything.
      const secondRun = applyMigrations(sqlite, MIGRATIONS_FOLDER);
      expect(secondRun).toBe(0);
      expect(countAppliedMigrations(sqlite)).toBe(firstRun);
    } finally {
      sqlite.close();
    }
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("opens connections with WAL, foreign keys, and a 5s busy timeout", () => {
    const sqlite = getSqliteHandle();
    expect(sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(sqlite.pragma("busy_timeout", { simple: true })).toBe(5000);
  });

  it("reuses a single connection through the globalThis singleton", () => {
    expect(getDb()).toBe(getDb());
    expect(getSqliteHandle().open).toBe(true);
  });
});
