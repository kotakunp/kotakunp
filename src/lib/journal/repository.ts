import { randomUUID } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { journalPostMedia, journalPostTags, journalPosts, tags } from "@/db/schema";

export type PostStatus = "draft" | "published";
export type PostStatusColumn = typeof journalPosts.status.enumValues;
export type JournalPostRow = typeof journalPosts.$inferSelect;
export type TagRow = typeof tags.$inferSelect;

export type CreatePostInput = {
  id?: string;
  slug: string;
  title: string;
  excerpt?: string;
  type?: string;
  bodyMarkdown?: string;
  status?: PostStatus;
  coverMediaId?: string | null;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdatePostInput = Partial<Omit<CreatePostInput, "id" | "createdAt">>;

export type TagInput = { name: string; slug: string };

export class JournalRepository {
  constructor(private readonly db: Db) {}

  async createPost(input: CreatePostInput): Promise<JournalPostRow> {
    const now = input.createdAt ?? input.updatedAt ?? new Date();
    const [row] = await this.db
      .insert(journalPosts)
      .values({
        id: input.id ?? randomUUID(),
        slug: input.slug,
        title: input.title,
        excerpt: input.excerpt ?? "",
        type: input.type ?? "",
        bodyMarkdown: input.bodyMarkdown ?? "",
        status: input.status ?? "draft",
        coverMediaId: input.coverMediaId ?? null,
        publishedAt: input.publishedAt ?? null,
        createdAt: now,
        updatedAt: input.updatedAt ?? now,
      })
      .returning();
    return row;
  }

  async getPostById(id: string): Promise<JournalPostRow | null> {
    const [row] = await this.db
      .select()
      .from(journalPosts)
      .where(eq(journalPosts.id, id))
      .limit(1);
    return row ?? null;
  }

  async getPostBySlug(slug: string): Promise<JournalPostRow | null> {
    const [row] = await this.db
      .select()
      .from(journalPosts)
      .where(eq(journalPosts.slug, slug))
      .limit(1);
    return row ?? null;
  }

  async listPosts(filter: { status?: PostStatus } = {}): Promise<JournalPostRow[]> {
    return this.db
      .select()
      .from(journalPosts)
      .where(filter.status ? eq(journalPosts.status, filter.status) : undefined)
      .orderBy(desc(journalPosts.publishedAt), desc(journalPosts.createdAt));
  }

  async updatePost(id: string, patch: UpdatePostInput): Promise<JournalPostRow | null> {
    const [row] = await this.db
      .update(journalPosts)
      .set({ ...patch, updatedAt: patch.updatedAt ?? new Date() })
      .where(eq(journalPosts.id, id))
      .returning();
    return row ?? null;
  }

  /** Returns true when a row was deleted. Join tables cascade via FK. */
  async deletePost(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(journalPosts)
      .where(eq(journalPosts.id, id))
      .returning({ id: journalPosts.id });
    return deleted.length > 0;
  }

  async upsertTag(input: TagInput & { id?: string }): Promise<TagRow> {
    const [row] = await this.db
      .insert(tags)
      .values({
        id: input.id ?? randomUUID(),
        name: input.name,
        slug: input.slug,
      })
      .onConflictDoUpdate({ target: tags.slug, set: { name: input.name } })
      .returning();
    return row;
  }

  async getTagBySlug(slug: string): Promise<TagRow | null> {
    const [row] = await this.db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
    return row ?? null;
  }

  async listTagsForPost(postId: string): Promise<TagRow[]> {
    return this.db
      .select({ id: tags.id, name: tags.name, slug: tags.slug })
      .from(journalPostTags)
      .innerJoin(tags, eq(journalPostTags.tagId, tags.id))
      .where(eq(journalPostTags.postId, postId));
  }

  /**
   * Upserts every tag by normalized slug and rewrites the post's join rows in
   * one transaction so partial syncs can never persist.
   *
   * better-sqlite3 transactions are synchronous, so every statement inside is
   * executed with its sync terminator (.run() / .all()) instead of awaiting.
   */
  syncPostTags(postId: string, tagsToSync: readonly TagInput[]): void {
    this.db.transaction((tx) => {
      for (const tag of tagsToSync) {
        tx.insert(tags)
          .values({ id: randomUUID(), name: tag.name, slug: tag.slug })
          .onConflictDoUpdate({ target: tags.slug, set: { name: tag.name } })
          .run();
      }
      const slugs = tagsToSync.map((tag) => tag.slug);
      const rows = slugs.length
        ? tx.select({ id: tags.id }).from(tags).where(inArray(tags.slug, slugs)).all()
        : [];
      tx.delete(journalPostTags).where(eq(journalPostTags.postId, postId)).run();
      if (rows.length > 0) {
        tx.insert(journalPostTags)
          .values(rows.map((row) => ({ postId, tagId: row.id })))
          .run();
      }
    });
  }

  /** Replaces the post's media join rows (parsed from Markdown on save). */
  syncPostMedia(postId: string, mediaIds: readonly string[]): void {
    this.db.transaction((tx) => {
      tx.delete(journalPostMedia).where(eq(journalPostMedia.postId, postId)).run();
      if (mediaIds.length > 0) {
        tx.insert(journalPostMedia)
          .values([...new Set(mediaIds)].map((mediaId) => ({ postId, mediaId })))
          .run();
      }
    });
  }

  async listMediaIdsForPost(postId: string): Promise<string[]> {
    const rows = await this.db
      .select({ mediaId: journalPostMedia.mediaId })
      .from(journalPostMedia)
      .where(eq(journalPostMedia.postId, postId));
    return rows.map((row) => row.mediaId);
  }
}
