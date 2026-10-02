import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import type { Db } from "@/db/client";
import { openContentDatabase } from "@/db/client";
import { applyMigrations } from "@/db/migrate";
import * as schema from "@/db/schema";
import { MusicRepository } from "@/lib/music/repository";

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

describe("music repository", () => {
  let tempDir: string;
  let sqlite: Database.Database;
  let db: Db;
  let repo: MusicRepository;

  beforeEach(() => {
    ({ tempDir, sqlite, db } = makeDb("kotakunp-music-"));
    repo = new MusicRepository(db);
  });

  afterEach(() => {
    sqlite.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function insertAudioMedia(id: string): Promise<void> {
    await db.insert(schema.media).values({
      id,
      kind: "audio",
      originalName: `${id}.mp3`,
      storageKey: `audio/${id}.mp3`,
      publicPath: `/media/${id}/${id}.mp3`,
      mimeType: "audio/mpeg",
      byteSize: 1000,
      durationMs: 30_000,
      source: "upload",
      createdAt: new Date(),
    });
  }

  it("enforces unique release slugs", async () => {
    await repo.createRelease({ slug: "grey-morning", title: "灰色の朝" });
    await expect(
      repo.createRelease({ slug: "grey-morning", title: "Duplicate" }),
    ).rejects.toMatchObject({ code: "SQLITE_CONSTRAINT_UNIQUE" });
  });

  it("cascades track rows when a release is deleted", async () => {
    const release = await repo.createRelease({
      slug: "end-roll",
      title: "エンドロールの後で",
    });
    const track = await repo.createTrack(release.id, { position: 1, title: "Track one" });
    await repo.createTrack(release.id, { position: 2, title: "Track two" });
    expect(await repo.listTracks(release.id)).toHaveLength(2);

    await repo.deleteRelease(release.id);
    expect(await repo.getTrackById(track.id)).toBeNull();
    expect(
      (sqlite.prepare("SELECT COUNT(*) c FROM music_tracks").get() as { c: number }).c,
    ).toBe(0);
  });

  it("allows the same position across releases but not within one release", async () => {
    const first = await repo.createRelease({ slug: "first", title: "First" });
    const second = await repo.createRelease({ slug: "second", title: "Second" });
    await repo.createTrack(first.id, { position: 1, title: "One" });

    // Same position on another release is fine.
    await repo.createTrack(second.id, { position: 1, title: "Also one" });

    await expect(
      repo.createTrack(first.id, { position: 1, title: "Clash" }),
    ).rejects.toMatchObject({ code: "SQLITE_CONSTRAINT_UNIQUE" });
  });

  it("sets track audio to null when audio media is deleted, keeping audio_kind", async () => {
    await insertAudioMedia("audio-x");
    const release = await repo.createRelease({ slug: "previewed", title: "Previewed" });
    const track = await repo.createTrack(release.id, {
      position: 1,
      title: "With audio",
      audioMediaId: "audio-x",
      audioKind: "preview",
    });
    expect(track.audioMediaId).toBe("audio-x");

    await insertAudioMedia("audio-y");
    await db.delete(schema.media).where(eq(schema.media.id, "audio-x"));

    const reloaded = await repo.getTrackById(track.id);
    expect(reloaded?.audioMediaId).toBeNull();
    expect(reloaded?.audioKind).toBe("preview");
  });

  it("filters releases by status/type and orders by release date", async () => {
    await repo.createRelease({
      slug: "old-published",
      title: "Old",
      status: "published",
      releaseDate: new Date("2024-12-22T00:00:00Z"),
      publishedAt: new Date("2024-12-22T00:00:00Z"),
      type: "single",
    });
    await repo.createRelease({
      slug: "new-published",
      title: "New",
      status: "published",
      releaseDate: new Date("2026-05-01T00:00:00Z"),
      publishedAt: new Date("2026-05-01T00:00:00Z"),
      type: "album",
    });
    await repo.createRelease({ slug: "hidden-draft", title: "Hidden" });

    const published = await repo.listReleases({ status: "published" });
    expect(published.map((release) => release.slug)).toEqual([
      "new-published",
      "old-published",
    ]);
    const singles = await repo.listReleases({ status: "published", type: "single" });
    expect(singles.map((release) => release.slug)).toEqual(["old-published"]);
    expect(await repo.listReleases()).toHaveLength(3);
  });

  it("keeps imported catalog metadata in declared_* fields without track rows", async () => {
    const release = await repo.createRelease({
      slug: "journey",
      title: "終点のない旅",
      englishTitle: "A journey without a terminus",
      type: "ost",
      releaseDate: new Date("2025-04-03T00:00:00Z"),
      declaredTrackCount: 7,
      declaredDurationMs: 1_574_000,
      status: "published",
      publishedAt: new Date(),
    });
    expect(release.declaredTrackCount).toBe(7);
    expect(release.declaredDurationMs).toBe(1_574_000);
    expect(await repo.listTracks(release.id)).toHaveLength(0);
  });
});
