import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["image", "audio"] }).notNull(),
  originalName: text("original_name").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  publicPath: text("public_path").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  alt: text("alt"),
  durationMs: integer("duration_ms"),
  width: integer("width"),
  height: integer("height"),
  source: text("source", { enum: ["upload", "bundled"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const musicReleases = sqliteTable("music_releases", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  englishTitle: text("english_title").notNull().default(""),
  type: text("type", { enum: ["single", "ep", "album", "ost"] }),
  descriptionMarkdown: text("description_markdown").notNull().default(""),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  coverMediaId: text("cover_media_id").references(() => media.id, {
    onDelete: "set null",
  }),
  releaseDate: integer("release_date", { mode: "timestamp_ms" }),
  declaredTrackCount: integer("declared_track_count"),
  declaredDurationMs: integer("declared_duration_ms"),
  duuToUrl: text("duu_to_url"),
  youtubeUrl: text("youtube_url"),
  spotifyUrl: text("spotify_url"),
  appleMusicUrl: text("apple_music_url"),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const musicTracks = sqliteTable(
  "music_tracks",
  {
    id: text("id").primaryKey(),
    releaseId: text("release_id")
      .notNull()
      .references(() => musicReleases.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    englishTitle: text("english_title"),
    lyricsMarkdown: text("lyrics_markdown"),
    audioMediaId: text("audio_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    audioKind: text("audio_kind", { enum: ["none", "preview", "full"] })
      .notNull()
      .default("none"),
    durationMs: integer("duration_ms"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("music_tracks_release_position_unique").on(
      table.releaseId,
      table.position,
    ),
  ],
);
