import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ReleaseTrackPlayer } from "@/components/release-track-player";
import { getAdjacentPublishedReleases, getPublishedRelease } from "@/lib/music/queries";
import { getDictionary, isLocale } from "../../dictionaries";
import { formatDuration } from "@/lib/format-duration";
import { JournalMarkdown } from "@/components/journal-markdown";

type MusicRouteProps = PageProps<"/[lang]/music/[slug]">;

export async function generateMetadata({ params }: MusicRouteProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const release = await getPublishedRelease(slug);
  if (!release) return {};
  return {
    title: `${release.title} — kotakunp`,
    description: release.descriptionMarkdown,
  };
}

export default async function ReleaseDetailPage({ params }: MusicRouteProps) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const release = await getPublishedRelease(slug);
  if (!release) notFound();
  const copy = await getDictionary(lang);

  const adjacent = release.releaseDate
    ? await getAdjacentPublishedReleases(release.releaseDate, release.id)
    : { previous: null, next: null };

  const smartlinks = Object.entries(release.smartlinks).filter(([, url]) => url !== null);

  const emptyMediaMap = new Map<string, { publicPath: string; kind: "image" | "audio" }>();

  return (
    <main id="top">
      <SiteHeader locale={lang} active="music" labels={copy.nav} />
      <article className="release-detail page-width">
        <div className="release-detail-grid">
          <div className="featured-cover">
            {release.coverPath ? (
              <Image src={release.coverPath} alt={release.coverAlt ?? `Cover art for ${release.englishTitle}`} fill sizes="(max-width: 760px) 100vw, 320px" priority />
            ) : null}
          </div>
          <div className="featured-copy">
            <span className="tag">{release.type}</span>
            <h1>{release.title}</h1>
            <p>{release.englishTitle}</p>
            <p>
              {release.releaseDate?.slice(0, 10)} | {release.trackCount} tracks |{" "}
              {formatDuration(release.totalDurationMs)}
            </p>
            <JournalMarkdown markdown={release.descriptionMarkdown} mediaMap={emptyMediaMap} />
            {smartlinks.length > 0 ? (
              <div className="inline-links smartlinks">
                {smartlinks.map(([name, url]) => (
                  <a key={name} href={url as string} target="_blank" rel="noreferrer noopener">
                    {name.replace(/Url$/, "")} →
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {release.tracks.length > 0 ? (
          <section className="release-section">
            <h2 className="section-title">{copy.musicPage.tracklist}</h2>
            <ReleaseTrackPlayer tracks={release.tracks} />
            {release.tracks.some((track) => track.lyricsMarkdown) ? (
              <section id="lyrics" className="lyrics-block-group">
                {release.tracks
                  .filter((track) => track.lyricsMarkdown)
                  .map((track) => (
                    <div className="lyrics-block" key={track.id}>
                      <h3>
                        {String(track.position).padStart(2, "0")}. {track.title}
                      </h3>
                      <JournalMarkdown markdown={track.lyricsMarkdown ?? ""} mediaMap={emptyMediaMap} />
                    </div>
                  ))}
              </section>
            ) : null}
          </section>
        ) : null}

        <nav className="adjacent-nav" aria-label="More releases">
          {adjacent.previous ? (
            <Link href={`/${lang}/music/${adjacent.previous.slug}`}>← {adjacent.previous.title}</Link>
          ) : (
            <span />
          )}
          {adjacent.next ? (
            <Link href={`/${lang}/music/${adjacent.next.slug}`}>{adjacent.next.title} →</Link>
          ) : (
            <span />
          )}
        </nav>
        <Link className="text-link" href={`/${lang}/music`}>
          {copy.musicPage.discography} →
        </Link>
      </article>
      <SiteFooter locale={lang} labels={copy.nav} />
    </main>
  );
}
