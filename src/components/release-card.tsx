import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import type { PublishedReleaseView } from "@/lib/music/queries";
import { formatDuration } from "@/lib/format-duration";

export function ReleaseCard({
  release,
  detailed = false,
  locale,
}: {
  release: PublishedReleaseView;
  detailed?: boolean;
  locale: string;
}) {
  const hasLyrics = detailed && release.tracks.some((track) => track.lyricsMarkdown);
  return (
    <article className={`release-card${detailed ? " release-card-detailed" : ""}`}>
      <div className="release-cover">
        {release.coverPath ? (
          <Image src={release.coverPath} alt={release.coverAlt ?? `Cover art for ${release.englishTitle}`} fill sizes="(max-width: 760px) 46vw, 220px" />
        ) : null}
      </div>
      <span className="tag">{release.type}</span>
      <h3>{release.title}</h3>
      <p>{release.releaseDate?.slice(0, 10)}</p>
      {detailed ? <p>{formatDuration(release.totalDurationMs)}</p> : null}
      <div className="card-actions">
        <Link href={`/${locale}/music/${release.slug}`}>listen →</Link>
        {hasLyrics ? (
          <Link href={`/${locale}/music/${release.slug}#lyrics`}>lyrics →</Link>
        ) : detailed ? (
          <span>lyrics →</span>
        ) : (
          <Play className="play-icon" aria-label="Play" size={14} fill="currentColor" />
        )}
      </div>
    </article>
  );
}
