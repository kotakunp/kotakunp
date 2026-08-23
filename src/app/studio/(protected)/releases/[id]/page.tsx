import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { MusicRepository } from "@/lib/music/repository";
import { ReleaseEditor } from "@/components/studio/release-editor";

export const dynamic = "force-dynamic";

export default async function EditReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const repo = new MusicRepository(db);
  const release = await repo.getReleaseById(id);
  if (!release) return <p className="studio-page">Release not found.</p>;
  const tracks = await repo.listTracks(id);

  let coverAlt: string | null = null;
  if (release.coverMediaId) {
    const rows = await db
      .select({ alt: schema.media.alt })
      .from(schema.media)
      .where(eq(schema.media.id, release.coverMediaId))
      .limit(1);
    coverAlt = rows[0]?.alt ?? null;
  }

  return (
    <ReleaseEditor
      release={{
        id: release.id,
        title: release.title,
        englishTitle: release.englishTitle,
        slug: release.slug,
        type: release.type,
        descriptionMarkdown: release.descriptionMarkdown,
        status: release.status,
        coverMediaId: release.coverMediaId,
        releaseDate: release.releaseDate ? release.releaseDate.toISOString().slice(0, 10) : "",
        duuToUrl: release.duuToUrl,
        youtubeUrl: release.youtubeUrl,
        spotifyUrl: release.spotifyUrl,
        appleMusicUrl: release.appleMusicUrl,
      }}
      initialTracks={tracks.map((track) => ({
        id: track.id,
        position: track.position,
        title: track.title,
        lyricsMarkdown: track.lyricsMarkdown ?? "",
        audioMediaId: track.audioMediaId,
        audioKind: track.audioKind,
        durationMs: track.durationMs,
      }))}
      initialCoverAlt={coverAlt}
    />
  );
}
