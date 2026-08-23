import { and, asc, desc, eq, isNotNull, lte, or, sql } from "drizzle-orm";
import { unstable_cache, revalidateTag } from "next/cache";
import { getDb } from "@/db/client";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";

export const MUSIC_CACHE_TAG = "music";
const MUSIC_REVALIDATE_SECONDS = 3600;

export type ReleaseType = "single" | "ep" | "album" | "ost";

export type SmartlinkView = {
  duuTo: string | null;
  youtube: string | null;
  spotify: string | null;
  appleMusic: string | null;
};

export type ReleaseTrackView = {
  id: string;
  position: number;
  title: string;
  englishTitle: string | null;
  lyricsMarkdown: string | null;
  audioPath: string | null;
  audioKind: "none" | "preview" | "full";
  durationMs: number | null;
};

export type PublishedReleaseView = {
  id: string;
  slug: string;
  title: string;
  englishTitle: string;
  type: ReleaseType | null;
  descriptionMarkdown: string;
  coverPath: string | null;
  coverAlt: string | null;
  releaseDate: string | null;
  trackCount: number;
  totalDurationMs: number | null;
  smartlinks: SmartlinkView;
  tracks: ReleaseTrackView[];
  publishedAt: string;
  updatedAt: string;
};

export type AdjacentReleasesView = {
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

function publishedReleaseFilter() {
  const now = new Date();
  return and(
    eq(schema.musicReleases.status, "published"),
    isNotNull(schema.musicReleases.publishedAt),
    lte(schema.musicReleases.publishedAt, now),
  );
}

function toIso(value: Date | null): string {
  return value instanceof Date ? value.toISOString() : new Date(0).toISOString();
}

type CoverInfo = { publicPath: string; alt: string | null };

async function resolveCoverMap(
  db: Db,
  mediaIds: (string | null)[],
): Promise<Map<string, CoverInfo>> {
  const ids = [
    ...new Set(mediaIds.filter((value): value is string => value !== null)),
  ];
  const map = new Map<string, CoverInfo>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      id: schema.media.id,
      publicPath: schema.media.publicPath,
      alt: schema.media.alt,
    })
    .from(schema.media)
    .where(
      sql`${schema.media.id} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`,
    );
  for (const row of rows) {
    map.set(row.id, { publicPath: row.publicPath, alt: row.alt });
  }
  return map;
}

async function loadTracks(
  db: Db,
  releaseId: string,
): Promise<ReleaseTrackView[]> {
  const rows = await db
    .select({
      id: schema.musicTracks.id,
      position: schema.musicTracks.position,
      title: schema.musicTracks.title,
      englishTitle: schema.musicTracks.englishTitle,
      lyricsMarkdown: schema.musicTracks.lyricsMarkdown,
      audioMediaId: schema.musicTracks.audioMediaId,
      audioKind: schema.musicTracks.audioKind,
      durationMs: schema.musicTracks.durationMs,
      audioPublicPath: schema.media.publicPath,
    })
    .from(schema.musicTracks)
    .leftJoin(schema.media, eq(schema.musicTracks.audioMediaId, schema.media.id))
    .where(eq(schema.musicTracks.releaseId, releaseId))
    .orderBy(asc(schema.musicTracks.position));

  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    title: row.title,
    englishTitle: row.englishTitle,
    lyricsMarkdown: row.lyricsMarkdown,
    audioPath: row.audioKind === "none" ? null : row.audioPublicPath,
    audioKind: row.audioKind,
    durationMs: row.durationMs,
  }));
}

function deriveTotals(
  realTrackCount: number,
  realTotalDurationMs: number | null,
  declaredTrackCount: number | null,
  declaredDurationMs: number | null,
): { trackCount: number; totalDurationMs: number | null } {
  if (realTrackCount > 0) {
    return { trackCount: realTrackCount, totalDurationMs: realTotalDurationMs };
  }
  return {
    trackCount: declaredTrackCount ?? 0,
    totalDurationMs: declaredDurationMs,
  };
}

async function loadTrackAggregates(
  db: Db,
  releaseIds: string[],
): Promise<Map<string, { count: number; totalDurationMs: number | null }>> {
  const map = new Map<string, { count: number; totalDurationMs: number | null }>();
  if (releaseIds.length === 0) return map;
  const rows = await db
    .select({
      releaseId: schema.musicTracks.releaseId,
      count: sql<number>`count(*)`,
      total: sql<number | null>`sum(${schema.musicTracks.durationMs})`,
    })
    .from(schema.musicTracks)
    .where(
      sql`${schema.musicTracks.releaseId} in (${sql.join(releaseIds.map((id) => sql`${id}`), sql`, `)})`,
    )
    .groupBy(schema.musicTracks.releaseId);
  for (const row of rows) {
    map.set(row.releaseId, {
      count: Number(row.count),
      totalDurationMs: row.total === null ? null : Number(row.total),
    });
  }
  return map;
}

export async function getPublishedReleaseQuery(
  db: Db,
  slug: string,
): Promise<PublishedReleaseView | null> {
  const rows = await db
    .select()
    .from(schema.musicReleases)
    .where(and(eq(schema.musicReleases.slug, slug), publishedReleaseFilter()))
    .limit(1);
  if (rows.length === 0) return null;

  const release = rows[0];
  const cover = release.coverMediaId
    ? (
        await resolveCoverMap(db, [release.coverMediaId])
      ).get(release.coverMediaId)
    : undefined;
  const tracks = await loadTracks(db, release.id);
  const totals = deriveTotals(
    tracks.length,
    tracks.reduce((sum, track) => sum + (track.durationMs ?? 0), 0),
    release.declaredTrackCount,
    release.declaredDurationMs,
  );

  return {
    id: release.id,
    slug: release.slug,
    title: release.title,
    englishTitle: release.englishTitle,
    type: release.type,
    descriptionMarkdown: release.descriptionMarkdown,
    coverPath: cover?.publicPath ?? null,
    coverAlt: cover?.alt ?? null,
    releaseDate: release.releaseDate ? toIso(release.releaseDate) : null,
    trackCount: totals.trackCount,
    totalDurationMs: totals.totalDurationMs,
    smartlinks: {
      duuTo: release.duuToUrl,
      youtube: release.youtubeUrl,
      spotify: release.spotifyUrl,
      appleMusic: release.appleMusicUrl,
    },
    tracks,
    publishedAt: toIso(release.publishedAt),
    updatedAt: toIso(release.updatedAt),
  };
}

export async function listPublishedReleasesQuery(
  db: Db,
  type?: ReleaseType,
): Promise<PublishedReleaseView[]> {
  const rows = await db
    .select()
    .from(schema.musicReleases)
    .where(
      type === undefined
        ? publishedReleaseFilter()
        : and(publishedReleaseFilter(), eq(schema.musicReleases.type, type)),
    )
    .orderBy(desc(schema.musicReleases.releaseDate), desc(schema.musicReleases.id));

  if (rows.length === 0) return [];
  const covers = await resolveCoverMap(
    db,
    rows.map((row) => row.coverMediaId),
  );
  const aggregates = await loadTrackAggregates(db, rows.map((row) => row.id));

  return rows.map((row) => {
    const cover = row.coverMediaId ? covers.get(row.coverMediaId) : undefined;
    const aggregate = aggregates.get(row.id);
    const totals = deriveTotals(
      aggregate?.count ?? 0,
      aggregate?.totalDurationMs ?? null,
      row.declaredTrackCount,
      row.declaredDurationMs,
    );
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      englishTitle: row.englishTitle,
      type: row.type,
      descriptionMarkdown: row.descriptionMarkdown,
      coverPath: cover?.publicPath ?? null,
      coverAlt: cover?.alt ?? null,
      releaseDate: row.releaseDate ? toIso(row.releaseDate) : null,
      trackCount: totals.trackCount,
      totalDurationMs: totals.totalDurationMs,
      smartlinks: {
        duuTo: row.duuToUrl,
        youtube: row.youtubeUrl,
        spotify: row.spotifyUrl,
        appleMusic: row.appleMusicUrl,
      },
      tracks: [],
      publishedAt: toIso(row.publishedAt),
      updatedAt: toIso(row.updatedAt),
    };
  });
}

export async function getAdjacentPublishedReleasesQuery(
  db: Db,
  releaseDate: string,
  id: string,
): Promise<AdjacentReleasesView> {
  const anchorMs = new Date(releaseDate).getTime();
  const older = await db
    .select({ slug: schema.musicReleases.slug, title: schema.musicReleases.title })
    .from(schema.musicReleases)
    .where(
      and(
        publishedReleaseFilter(),
        isNotNull(schema.musicReleases.releaseDate),
        or(
          sql`${schema.musicReleases.releaseDate} < ${anchorMs}`,
          and(
            eq(schema.musicReleases.releaseDate, new Date(releaseDate)),
            sql`${schema.musicReleases.id} < ${id}`,
          ),
        ),
      ),
    )
    .orderBy(desc(schema.musicReleases.releaseDate), desc(schema.musicReleases.id))
    .limit(1);

  const newer = await db
    .select({ slug: schema.musicReleases.slug, title: schema.musicReleases.title })
    .from(schema.musicReleases)
    .where(
      and(
        publishedReleaseFilter(),
        isNotNull(schema.musicReleases.releaseDate),
        or(
          sql`${schema.musicReleases.releaseDate} > ${anchorMs}`,
          and(
            eq(schema.musicReleases.releaseDate, new Date(releaseDate)),
            sql`${schema.musicReleases.id} > ${id}`,
          ),
        ),
      ),
    )
    .orderBy(schema.musicReleases.releaseDate, schema.musicReleases.id)
    .limit(1);

  return {
    previous: older[0] ?? null,
    next: newer[0] ?? null,
  };
}

export type MusicChangeSnapshot = {
  status: "draft" | "published";
  slug: string;
} | null;

export function shouldInvalidatePublishedMusicChange(
  before: MusicChangeSnapshot,
  after: MusicChangeSnapshot,
): boolean {
  const beforePublic = before?.status === "published";
  const afterPublic = after?.status === "published";
  return beforePublic || afterPublic;
}

export async function listPublishedReleases(
  type?: ReleaseType,
): Promise<PublishedReleaseView[]> {
  const cached = unstable_cache(
    () => listPublishedReleasesQuery(getDb(), type),
    ["music", "releases", type ?? "all"],
    { tags: [MUSIC_CACHE_TAG], revalidate: MUSIC_REVALIDATE_SECONDS },
  );
  return cached();
}

export async function getLatestPublishedRelease(): Promise<PublishedReleaseView | null> {
  const cached = unstable_cache(
    async () => (await listPublishedReleasesQuery(getDb()))[0] ?? null,
    ["music", "latest"],
    { tags: [MUSIC_CACHE_TAG], revalidate: MUSIC_REVALIDATE_SECONDS },
  );
  return cached();
}

export async function getPublishedRelease(
  slug: string,
): Promise<PublishedReleaseView | null> {
  const cached = unstable_cache(
    () => getPublishedReleaseQuery(getDb(), slug),
    ["music", "release", slug],
    { tags: [MUSIC_CACHE_TAG], revalidate: MUSIC_REVALIDATE_SECONDS },
  );
  return cached();
}

export async function getAdjacentPublishedReleases(
  releaseDate: string,
  id: string,
): Promise<AdjacentReleasesView> {
  const cached = unstable_cache(
    () => getAdjacentPublishedReleasesQuery(getDb(), releaseDate, id),
    ["music", "adjacent", id],
    { tags: [MUSIC_CACHE_TAG], revalidate: MUSIC_REVALIDATE_SECONDS },
  );
  return cached();
}

export function invalidateMusicCache(): void {
  try {
    revalidateTag(MUSIC_CACHE_TAG, { expire: 0 });
  } catch (error) {
    // Outside a Next request/render context (scripts, tests) there is no
    // static-generation store; the fallback TTL expires the cache anyway.
    console.warn("Cache invalidation skipped:", error instanceof Error ? error.message : error);
  }
}
