import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import type { Db } from "@/db/client";
import { openContentDatabase } from "@/db/client";
import { applyMigrations } from "@/db/migrate";
import * as schema from "@/db/schema";
import {
  getAdjacentPublishedReleasesQuery,
  getPublishedReleaseQuery,
  listPublishedReleasesQuery,
  shouldInvalidatePublishedMusicChange,
} from "./queries";

function makeDb(prefix: string): { tempDir: string; sqlite: Database.Database; db: Db } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const sqlite = openContentDatabase(path.join(tempDir, "content.sqlite"), {
    allowCreate: true,
  });
  applyMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  // Structural migrations also import legacy content; tests need an empty DB.
  for (const table of [schema.musicTracks, schema.musicReleases, schema.media]) {
    db.delete(table).run();
  }
  return { tempDir, sqlite, db };
}

async function insertMedia(db: Db, id: string, kind: "image" | "audio"): Promise<void> {
  await db.insert(schema.media).values({
    id,
    kind,
    originalName: `${id}.${kind === "image" ? "webp" : "mp3"}`,
    storageKey: `${kind === "image" ? "images" : "audio"}/${id}`,
    publicPath: `/media/${id}/file.${kind === "image" ? "webp" : "mp3"}`,
    mimeType: kind === "image" ? "image/webp" : "audio/mpeg",
    byteSize: 10,
    alt: kind === "image" ? `Cover ${id}` : null,
    durationMs: kind === "audio" ? 90_000 : null,
    source: "upload",
    createdAt: new Date(),
  });
}

async function insertRelease(
  db: Db,
  input: {
    id: string;
    slug: string;
    status?: "draft" | "published";
    releaseDate?: Date | null;
    publishedAt?: Date | null;
    declaredTrackCount?: number;
    declaredDurationMs?: number;
    type?: "single" | "ep" | "album" | "ost";
    coverMediaId?: string;
  },
) {
  await db.insert(schema.musicReleases).values({
    id: input.id,
    slug: input.slug,
    title: `Title ${input.slug}`,
    englishTitle: `English ${input.slug}`,
    type: input.type ?? "single",
    descriptionMarkdown: `Description ${input.slug}`,
    status: input.status ?? "published",
    coverMediaId: input.coverMediaId ?? null,
    releaseDate: input.releaseDate ?? null,
    declaredTrackCount: input.declaredTrackCount ?? null,
    declaredDurationMs: input.declaredDurationMs ?? null,
    publishedAt:
      input.publishedAt ??
      (input.status === "draft" ? null : (input.releaseDate ?? new Date())),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("music queries", () => {
  let tempDir: string;
  let sqlite: Database.Database;
  let db: Db;

  beforeEach(() => {
    ({ tempDir, sqlite, db } = makeDb("kotakunp-music-queries-"));
  });

  afterEach(() => {
    sqlite.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("excludes drafts and future releases, orders newest first", async () => {
    const past = new Date("2026-05-01");
    const older = new Date("2025-05-01");
    const future = new Date(Date.now() + 86_400_000);
    await insertRelease(db, { id: "r1", slug: "newer", releaseDate: past });
    await insertRelease(db, { id: "r2", slug: "older", releaseDate: older });
    await insertRelease(db, { id: "r3", slug: "drafted", status: "draft", releaseDate: past });
    await insertRelease(db, { id: "r4", slug: "future", releaseDate: future });

    const releases = await listPublishedReleasesQuery(db);
    expect(releases.map((release) => release.slug)).toEqual(["newer", "older"]);
  });

  it("filters by type and derives totals from declared fields when no tracks exist", async () => {
    const past = new Date("2026-02-20");
    await insertRelease(db, {
      id: "ep1",
      slug: "an-ep",
      type: "ep",
      releaseDate: past,
      declaredTrackCount: 6,
      declaredDurationMs: 1_268_000,
    });
    await insertRelease(db, { id: "s1", slug: "a-single", type: "single", releaseDate: past });

    const eps = await listPublishedReleasesQuery(db, "ep");
    expect(eps).toHaveLength(1);
    expect(eps[0].trackCount).toBe(6);
    expect(eps[0].totalDurationMs).toBe(1_268_000);
    expect((await listPublishedReleasesQuery(db, "album"))).toHaveLength(0);
  });

  it("returns full detail with ordered tracks, audio paths, and derived totals", async () => {
    const past = new Date("2026-05-01");
    await insertMedia(db, "cover-a", "image");
    await insertMedia(db, "mp3-one", "audio");
    await insertRelease(db, {
      id: "rel",
      slug: "with-tracks",
      releaseDate: past,
      coverMediaId: "cover-a",
      declaredTrackCount: 99,
      declaredDurationMs: 999_000,
    });
    await db.insert(schema.musicTracks).values([
      {
        id: "t2",
        releaseId: "rel",
        position: 2,
        title: "Second",
        audioKind: "none",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "t1",
        releaseId: "rel",
        position: 1,
        title: "First",
        lyricsMarkdown: "La la",
        audioMediaId: "mp3-one",
        audioKind: "preview",
        durationMs: 90_000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const release = await getPublishedReleaseQuery(db, "with-tracks");
    expect(release).not.toBeNull();
    expect(release?.coverPath).toBe("/media/cover-a/file.webp");
    expect(release?.tracks.map((track) => track.position)).toEqual([1, 2]);
    expect(release?.tracks[0].audioPath).toBe("/media/mp3-one/file.mp3");
    expect(release?.tracks[0].audioKind).toBe("preview");
    expect(release?.tracks[1].audioPath).toBeNull();
    expect(release?.trackCount).toBe(2);
    expect(release?.totalDurationMs).toBe(90_000);
  });

  it("hides draft releases by slug", async () => {
    await insertRelease(db, { id: "d1", slug: "secret", status: "draft" });
    expect(await getPublishedReleaseQuery(db, "secret")).toBeNull();
  });

  it("selects adjacent releases deterministically on equal dates", async () => {
    const same = new Date("2026-01-01");
    await insertRelease(db, { id: "aaa", slug: "aaa", releaseDate: same });
    await insertRelease(db, { id: "bbb", slug: "bbb", releaseDate: same });
    await insertRelease(db, { id: "ccc", slug: "ccc", releaseDate: same });

    const middle = await getAdjacentPublishedReleasesQuery(db, same.toISOString(), "bbb");
    expect(middle.previous?.slug).toBe("aaa");
    expect(middle.next?.slug).toBe("ccc");
  });

  it("invalidates on any published involvement, never draft-to-draft", () => {
    const draft = { status: "draft" as const, slug: "s" };
    const published = { status: "published" as const, slug: "s" };
    expect(shouldInvalidatePublishedMusicChange(draft, draft)).toBe(false);
    expect(shouldInvalidatePublishedMusicChange(null, draft)).toBe(false);
    expect(shouldInvalidatePublishedMusicChange(draft, published)).toBe(true);
    expect(shouldInvalidatePublishedMusicChange(published, draft)).toBe(true);
    expect(shouldInvalidatePublishedMusicChange(published, null)).toBe(true);
  });
});
