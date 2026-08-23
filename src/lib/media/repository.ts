import { desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";

export type MediaRow = typeof schema.media.$inferSelect;

export type CreateMediaInput = {
  id: string;
  kind: "image" | "audio";
  originalName: string;
  storageKey: string;
  publicPath: string;
  mimeType: string;
  byteSize: number;
  alt?: string | null;
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
  source: "upload" | "bundled";
};

export class MediaRepository {
  constructor(private readonly db: Db) {}

  async createMedia(input: CreateMediaInput): Promise<MediaRow> {
    const rows = await this.db
      .insert(schema.media)
      .values({
        id: input.id,
        kind: input.kind,
        originalName: input.originalName,
        storageKey: input.storageKey,
        publicPath: input.publicPath,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        alt: input.alt ?? null,
        durationMs: input.durationMs ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        source: input.source,
        createdAt: new Date(),
      })
      .returning();
    return rows[0];
  }

  async getMediaById(id: string): Promise<MediaRow | null> {
    const rows = await this.db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async listRecentMedia(limit = 50): Promise<MediaRow[]> {
    return this.db
      .select()
      .from(schema.media)
      .orderBy(desc(schema.media.createdAt))
      .limit(Math.min(Math.max(limit, 1), 200));
  }

  async updateAlt(id: string, alt: string): Promise<void> {
    await this.db.update(schema.media).set({ alt }).where(eq(schema.media.id, id));
  }

  async getManyByIds(ids: string[]): Promise<MediaRow[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(schema.media).where(inArray(schema.media.id, ids));
  }
}
