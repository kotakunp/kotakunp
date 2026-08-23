import Image from "next/image";
import Link from "next/link";
import { Circle, Play } from "lucide-react";
import { notFound } from "next/navigation";
import { DiscographyFilter } from "@/components/discography-filter";
import { HeroVisual } from "@/components/hero-visual";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SocialLinks } from "@/components/social-links";
import { NewsletterForm } from "@/components/newsletter-form";
import {
  listPublishedReleases,
  type PublishedReleaseView,
} from "@/lib/music/queries";
import { getDictionary, isLocale } from "../dictionaries";
import { formatDuration } from "@/lib/format-duration";

export default async function MusicPage({ params }: PageProps<"/[lang]/music">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const copy = await getDictionary(lang);

  const releases = await listPublishedReleases();
  const latest: PublishedReleaseView | undefined = releases[0];

  return (
    <main id="top">
      <SiteHeader locale={lang} active="music" labels={copy.nav} />
      <section className="inner-hero page-width">
        <div>
          <h1>{copy.musicPage.title}</h1>
          <p className="multiline">{copy.musicPage.intro}</p>
          <span className="dash">---</span>
          <SocialLinks soonLabel={copy.footer.soon} />
        </div>
        <HeroVisual />
      </section>

      {latest ? (
        <section className="featured-release page-width">
          <h2 className="section-title">{copy.musicPage.latest}</h2>
          <div className="featured-release-grid">
            <div className="featured-cover">
              {latest.coverPath ? (
                <Image src={latest.coverPath} alt={latest.coverAlt ?? `Cover art for ${latest.englishTitle}`} fill sizes="220px" priority />
              ) : null}
            </div>
            <div className="featured-copy">
              <span className="tag">{latest.type}</span>
              <h2>{latest.title}</h2>
              <p>{latest.releaseDate?.slice(0, 10)} | {formatDuration(latest.totalDurationMs)}</p>
              <p>{latest.descriptionMarkdown}</p>
              <div className="inline-links">
                <Link href={`/${lang}/music/${latest.slug}`}>{copy.musicPage.listen} →</Link>
                {latest.tracks.some((track) => track.lyricsMarkdown) ? (
                  <Link href={`/${lang}/music/${latest.slug}#lyrics`}>{copy.musicPage.lyrics} →</Link>
                ) : (
                  <span>{copy.musicPage.lyrics} →</span>
                )}
              </div>
            </div>
            <div className="track-list">
              {latest.tracks.map((track, index) => (
                <div key={track.id}>
                  <span>
                    {index === 0 ? <Circle size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                  </span>
                  <b>
                    {String(index + 1).padStart(2, "0")}. {track.title}
                  </b>
                  <time>{formatDuration(track.durationMs)}</time>
                </div>
              ))}
              <Link href="#discography">{copy.musicPage.allTracks} →</Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="discography page-width" id="discography">
        <div className="section-head">
          <div>
            <h2 className="section-title">{copy.musicPage.discography}</h2>
          </div>
          <span>{copy.musicPage.newest} ▾</span>
        </div>
        <DiscographyFilter releases={releases} locale={lang} />
      </section>

      <section className="music-cta page-width">
        <div>
          <h2>{copy.musicPage.stay}</h2>
          <p>{copy.musicPage.updates}</p>
        </div>
        <NewsletterForm
          copy={{
            email: copy.musicPage.email,
            send: copy.musicPage.newsletterSend,
            sending: copy.musicPage.newsletterSending,
            success: copy.musicPage.newsletterSuccess,
            error: copy.musicPage.newsletterError,
          }}
        />
        <div>
          <h2>{copy.musicPage.work}</h2>
          <p>{copy.musicPage.workNote}</p>
        </div>
        <Link href={`/${lang}/contact`}>{copy.nav.contact} →</Link>
      </section>
      <SiteFooter locale={lang} labels={copy.nav} />
    </main>
  );
}
