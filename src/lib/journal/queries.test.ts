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
  countMarkdownWords,
  getAdjacentPublishedPostsQuery,
  getPublishedPostQuery,
  listPublishedPostsQuery,
  listPublishedTagsQuery,
  readingTimeMinutes,
  shouldInvalidatePublishedJournalChange,
} from "./queries";

function makeDb(prefix: string): { tempDir: string; sqlite: Database.Database; db: Db } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const sqlite = openContentDatabase(path.join(tempDir, "content.sqlite"), {
    allowCreate: true,
  });
  applyMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  // Structural migrations also import legacy content; tests need an empty DB.
  for (const table of [
    schema.musicTracks,
    schema.musicReleases,
    schema.journalPostTags,
    schema.journalPostMedia,
    schema.journalPosts,
    schema.tags,
    schema.media,
  ]) {
    db.delete(table).run();
  }
  return { tempDir, sqlite, db };
}

async function insertMedia(db: Db, id: string): Promise<void> {
  await db.insert(schema.media).values({
    id,
    kind: "image",
    originalName: `${id}.webp`,
    storageKey: `images/${id}.webp`,
    publicPath: `/media/${id}/cover.webp`,
    mimeType: "image/webp",
    byteSize: 10,
    alt: `Cover ${id}`,
    source: "upload",
    createdAt: new Date(),
  });
}

async function insertPost(
  db: Db,
  input: {
    id: string;
    slug: string;
    status?: "draft" | "published";
    publishedAt?: Date | null;
    bodyMarkdown?: string;
    coverMediaId?: string | null;
  },
) {
  await db.insert(schema.journalPosts).values({
    id: input.id,
    slug: input.slug,
    title: `Title ${input.slug}`,
    excerpt: `Excerpt ${input.slug}`,
    type: "studio note",
    bodyMarkdown: input.bodyMarkdown ?? "Some words here",
    status: input.status ?? "published",
    coverMediaId: input.coverMediaId ?? null,
    publishedAt: input.publishedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("journal queries", () => {
  let tempDir: string;
  let sqlite: Database.Database;
  let db: Db;

  beforeEach(() => {
    ({ tempDir, sqlite, db } = makeDb("kotakunp-journal-queries-"));
  });

  afterEach(() => {
    sqlite.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("excludes drafts and future-dated posts", async () => {
    const past = new Date(Date.now() - 86_400_000);
    const future = new Date(Date.now() + 86_400_000);
    await insertPost(db, { id: "p1", slug: "live-one", publishedAt: past });
    await insertPost(db, { id: "p2", slug: "draft-one", status: "draft", publishedAt: past });
    await insertPost(db, { id: "p3", slug: "future-one", publishedAt: future });

    const posts = await listPublishedPostsQuery(db);
    expect(posts.map((post) => post.slug)).toEqual(["live-one"]);
  });

  it("orders newest first and resolves covers and tags", async () => {
    await insertMedia(db, "cover-1");
    const older = new Date(Date.now() - 3_600_000);
    const newer = new Date(Date.now() - 1_800_000);
    await insertPost(db, { id: "old", slug: "old-post", publishedAt: older, coverMediaId: null });
    await insertPost(db, { id: "new", slug: "new-post", publishedAt: newer, coverMediaId: "cover-1" });
    await db.insert(schema.tags).values([
      { id: "t1", name: "process", slug: "process" },
      { id: "t2", name: "release", slug: "release" },
    ]);
    await db.insert(schema.journalPostTags).values([
      { postId: "new", tagId: "t1" },
      { postId: "new", tagId: "t2" },
      { postId: "old", tagId: "t2" },
    ]);

    const posts = await listPublishedPostsQuery(db);
    expect(posts.map((post) => post.slug)).toEqual(["new-post", "old-post"]);
    expect(posts[0].coverPath).toBe("/media/cover-1/cover.webp");
    expect(posts[0].coverAlt).toBe("Cover cover-1");
    expect(posts[0].tags.map((tag) => tag.slug).sort()).toEqual(["process", "release"]);
    expect(posts[1].tags.map((tag) => tag.slug)).toEqual(["release"]);
  });

  it("filters by tag slug and returns empty for unknown tags", async () => {
    const past = new Date(Date.now() - 3_600_000);
    await insertPost(db, { id: "a", slug: "tagged", publishedAt: past });
    await insertPost(db, { id: "b", slug: "untagged", publishedAt: past });
    await db.insert(schema.tags).values({ id: "t1", name: "process", slug: "process" });
    await db.insert(schema.journalPostTags).values({ postId: "a", tagId: "t1" });

    expect((await listPublishedPostsQuery(db, "process")).map((p) => p.slug)).toEqual(["tagged"]);
    expect(await listPublishedPostsQuery(db, "nope")).toEqual([]);
  });

  it("returns adjacent posts with deterministic same-timestamp tiebreak", async () => {
    const same = new Date(Date.now() - 3_600_000);
    await insertPost(db, { id: "aaa", slug: "aaa", publishedAt: same });
    await insertPost(db, { id: "bbb", slug: "bbb", publishedAt: same });
    await insertPost(db, { id: "ccc", slug: "ccc", publishedAt: same });

    const middle = await getAdjacentPublishedPostsQuery(db, same.toISOString(), "bbb");
    expect(middle.previous?.slug).toBe("aaa");
    expect(middle.next?.slug).toBe("ccc");

    const first = await getAdjacentPublishedPostsQuery(db, same.toISOString(), "aaa");
    expect(first.previous).toBeNull();
    expect(first.next?.slug).toBe("bbb");
  });

  it("lists only tags attached to published posts", async () => {
    const past = new Date(Date.now() - 3_600_000);
    await insertPost(db, { id: "pub", slug: "pub", publishedAt: past });
    await insertPost(db, { id: "dr", slug: "dr", status: "draft", publishedAt: null });
    await db.insert(schema.tags).values([
      { id: "t1", name: "used", slug: "used" },
      { id: "t2", name: "orphan", slug: "orphan" },
      { id: "t3", name: "draft-only", slug: "draft-only" },
    ]);
    await db.insert(schema.journalPostTags).values([
      { postId: "pub", tagId: "t1" },
      { postId: "dr", tagId: "t3" },
    ]);

    const tags = await listPublishedTagsQuery(db);
    expect(tags).toEqual([{ name: "used", slug: "used" }]);
  });

  it("gets a single published post and hides drafts by slug", async () => {
    const past = new Date(Date.now() - 3_600_000);
    await insertPost(db, { id: "p1", slug: "visible", publishedAt: past });
    await insertPost(db, { id: "p2", slug: "hidden", status: "draft", publishedAt: null });

    expect((await getPublishedPostQuery(db, "visible"))?.slug).toBe("visible");
    expect(await getPublishedPostQuery(db, "hidden")).toBeNull();
  });

  it("computes reading time excluding fences and directives", () => {
    const markdown = [
      "---",
      "A short paragraph with several common words here.",
      "```js",
      "const ignored = 'code fence words do not count at all';",
      "```",
      "::audio[Nice take]{id=\"123e4567\"}",
      "![alt text](/media/x/x.png)",
      "A [link text](https://example.com) counts as its text.",
    ].join("\n");
    const words = countMarkdownWords(markdown);
    expect(words).toBeGreaterThan(0);
    expect(words).not.toBe(countMarkdownWords("ignored".repeat(50)));
    expect(readingTimeMinutes("one two three")).toBe(1);
    expect(readingTimeMinutes("word ".repeat(441))).toBe(3);
  });

  it("invalidates on any published involvement, never draft-to-draft", () => {
    const draft = { status: "draft" as const, slug: "s" };
    const published = { status: "published" as const, slug: "s" };
    expect(shouldInvalidatePublishedJournalChange(draft, draft)).toBe(false);
    expect(shouldInvalidatePublishedJournalChange(null, draft)).toBe(false);
    expect(shouldInvalidatePublishedJournalChange(draft, published)).toBe(true);
    expect(shouldInvalidatePublishedJournalChange(published, published)).toBe(true);
    expect(shouldInvalidatePublishedJournalChange(published, draft)).toBe(true);
    expect(shouldInvalidatePublishedJournalChange(published, null)).toBe(true);
    expect(shouldInvalidatePublishedJournalChange(null, published)).toBe(true);
  });
});
