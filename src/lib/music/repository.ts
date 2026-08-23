import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { musicReleases, musicTracks } from "@/db/schema";

export type ReleaseStatus = "draft" | "published";
export type ReleaseType = (typeof musicReleases.type.enumValues)[number];
export type TrackAudioKind = (typeof musicTracks.audioKind.enumValues)[number];
export type MusicReleaseRow = typeof musicReleases.$inferSelect;
export type MusicTrackRow = typeof musicTracks.$inferSelect;

export type CreateReleaseInput = {
  id?: string;
  slug: string;
  title: string;
  englishTitle?: string;
  type?: ReleaseType | null;
  descriptionMarkdown?: string;
  status?: ReleaseStatus;
  coverMediaId?: string | null;
  releaseDate?: Date | null;
  declaredTrackCount?: number | null;
  declaredDurationMs?: number | null;
  duuToUrl?: string | null;
  youtubeUrl?: string | null;
  spotifyUrl?: string | null;
  appleMusicUrl?: string | null;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateReleaseInput = Partial<Omit<CreateReleaseInput, "id" | "createdAt">>;

export type CreateTrackInput = {
  id?: string;
  position: number;
  title: string;
  englishTitle?: string | null;
  lyricsMarkdown?: string | null;
  audioMediaId?: string | null;
  audioKind?: TrackAudioKind;
  durationMs?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateTrackInput = Partial<Omit<CreateTrackInput, "id" | "releaseId" | "createdAt">>;

export class MusicRepository {
  constructor(private readonly db: Db) {}

  async createRelease(input: CreateReleaseInput): Promise<MusicReleaseRow> {
    const now = input.createdAt ?? input.updatedAt ?? new Date();
    const [row] = await this.db
      .insert(musicReleases)
      .values({
        id: input.id ?? randomUUID(),
        slug: input.slug,
        title: input.title,
        englishTitle: input.englishTitle ?? "",
        type: input.type ?? null,
        descriptionMarkdown: input.descriptionMarkdown ?? "",
        status: input.status ?? "draft",
        coverMediaId: input.coverMediaId ?? null,
        releaseDate: input.releaseDate ?? null,
        declaredTrackCount: input.declaredTrackCount ?? null,
        declaredDurationMs: input.declaredDurationMs ?? null,
        duuToUrl: input.duuToUrl ?? null,
        youtubeUrl: input.youtubeUrl ?? null,
        spotifyUrl: input.spotifyUrl ?? null,
        appleMusicUrl: input.appleMusicUrl ?? null,
        publishedAt: input.publishedAt ?? null,
        createdAt: now,
        updatedAt: input.updatedAt ?? now,
      })
      .returning();
    return row;
  }

  async getReleaseById(id: string): Promise<MusicReleaseRow | null> {
    const [row] = await this.db
      .select()
      .from(musicReleases)
      .where(eq(musicReleases.id, id))
      .limit(1);
    return row ?? null;
  }

  async getReleaseBySlug(slug: string): Promise<MusicReleaseRow | null> {
    const [row] = await this.db
      .select()
      .from(musicReleases)
      .where(eq(musicReleases.slug, slug))
      .limit(1);
    return row ?? null;
  }

  async listReleases(
    filter: { status?: ReleaseStatus; type?: ReleaseType } = {},
  ): Promise<MusicReleaseRow[]> {
    const conditions = [
      filter.status ? eq(musicReleases.status, filter.status) : undefined,
      filter.type ? eq(musicReleases.type, filter.type) : undefined,
    ].filter((condition) => condition !== undefined);
    return this.db
      .select()
      .from(musicReleases)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(musicReleases.releaseDate), desc(musicReleases.createdAt));
  }

  async updateRelease(
    id: string,
    patch: UpdateReleaseInput,
  ): Promise<MusicReleaseRow | null> {
    const [row] = await this.db
      .update(musicReleases)
      .set({ ...patch, updatedAt: patch.updatedAt ?? new Date() })
      .where(eq(musicReleases.id, id))
      .returning();
    return row ?? null;
  }

  /** Returns true when a row was deleted. Tracks cascade via FK. */
  async deleteRelease(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(musicReleases)
      .where(eq(musicReleases.id, id))
      .returning({ id: musicReleases.id });
    return deleted.length > 0;
  }

  async createTrack(releaseId: string, input: CreateTrackInput): Promise<MusicTrackRow> {
    const now = input.createdAt ?? input.updatedAt ?? new Date();
    const [row] = await this.db
      .insert(musicTracks)
      .values({
        id: input.id ?? randomUUID(),
        releaseId,
        position: input.position,
        title: input.title,
        englishTitle: input.englishTitle ?? null,
        lyricsMarkdown: input.lyricsMarkdown ?? null,
        audioMediaId: input.audioMediaId ?? null,
        audioKind: input.audioKind ?? "none",
        durationMs: input.durationMs ?? null,
        createdAt: now,
        updatedAt: input.updatedAt ?? now,
      })
      .returning();
    return row;
  }

  async getTrackById(trackId: string): Promise<MusicTrackRow | null> {
    const [row] = await this.db
      .select()
      .from(musicTracks)
      .where(eq(musicTracks.id, trackId))
      .limit(1);
    return row ?? null;
  }

  async listTracks(releaseId: string): Promise<MusicTrackRow[]> {
    return this.db
      .select()
      .from(musicTracks)
      .where(eq(musicTracks.releaseId, releaseId))
      .orderBy(asc(musicTracks.position));
  }

  async updateTrack(trackId: string, patch: UpdateTrackInput): Promise<MusicTrackRow | null> {
    const [row] = await this.db
      .update(musicTracks)
      .set({ ...patch, updatedAt: patch.updatedAt ?? new Date() })
      .where(eq(musicTracks.id, trackId))
      .returning();
    return row ?? null;
  }

  async deleteTrack(trackId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(musicTracks)
      .where(eq(musicTracks.id, trackId))
      .returning({ id: musicTracks.id });
    return deleted.length > 0;
  }
}
