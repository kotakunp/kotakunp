import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HeroVisual } from "@/components/hero-visual";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listPublishedPosts, listPublishedTags } from "@/lib/journal/queries";
import { getDictionary, isLocale } from "../dictionaries";

type JournalIndexProps = PageProps<"/[lang]/journal">;

export default async function JournalPage({ params, searchParams }: JournalIndexProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const copy = await getDictionary(lang);
  const { tag } = await searchParams;

  const tagSlug = typeof tag === "string" && tag.length > 0 ? tag : undefined;
  const [posts, tags] = await Promise.all([listPublishedPosts(tagSlug), listPublishedTags()]);
  const [featured, ...rest] = posts;
  const activeTag = tagSlug ?? null;

  return (
    <main id="top">
      <SiteHeader locale={lang} active="journal" labels={copy.nav} />
      <section className="inner-hero journal-hero page-width">
        <div>
          <h1>{copy.journalPage.title}</h1>
          <p>{copy.journalPage.intro}</p>
          <blockquote>{copy.journalPage.note}</blockquote>
        </div>
        <HeroVisual />
      </section>
      <section className="journal-index page-width">
        <div className="section-head">
          <h2 className="section-title">{copy.journalPage.latest}</h2>
          <span>
            {posts.length} {copy.journalPage.entries}
          </span>
        </div>
        <nav className="filter-nav journal-tag-filter" aria-label="Filter by tag">
          <Link href={`/${lang}/journal`} className={activeTag === null ? "active" : ""}>
            {copy.journalPage.all ?? "all"}
          </Link>
          {tags.map((tagView) => (
            <Link
              key={tagView.slug}
              href={`/${lang}/journal?tag=${tagView.slug}`}
              className={activeTag === tagView.slug ? "active" : ""}
            >
              {tagView.name}
            </Link>
          ))}
        </nav>

        {posts.length === 0 ? (
          <p className="empty-wall">{copy.journalPage.empty ?? "Nothing here yet."}</p>
        ) : (
          <>
            {featured ? (
              <Link
                className="journal-featured"
                href={`/${lang}/journal/${featured.slug}`}
              >
                <div className="journal-cover">
                  {featured.coverPath ? (
                    <Image src={featured.coverPath} alt={featured.coverAlt ?? ""} fill sizes="(max-width: 720px) 100vw, 300px" />
                  ) : null}
                </div>
                <div>
                  <span className="tag">{featured.type}</span>
                  <h2>{featured.title}</h2>
                  <p>{featured.excerpt}</p>
                  <small>
                    {featured.publishedAt.slice(0, 10)} · {featured.readingTimeMinutes} min
                  </small>
                  <span className="journal-read">{copy.journalPage.read} →</span>
                </div>
              </Link>
            ) : null}
            <div className="journal-grid">
              {rest.map((post) => (
                <Link key={post.id} className="journal-card" href={`/${lang}/journal/${post.slug}`}>
                  <div className="journal-cover">
                    {post.coverPath ? (
                      <Image src={post.coverPath} alt={post.coverAlt ?? ""} fill sizes="(max-width: 720px) 50vw, 260px" />
                    ) : null}
                  </div>
                  <span className="tag">{post.type}</span>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                  <small>
                    {post.publishedAt.slice(0, 10)} · {post.readingTimeMinutes} min
                  </small>
                  <span className="journal-read">{copy.journalPage.read} →</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
      <SiteFooter locale={lang} labels={copy.nav} />
    </main>
  );
}
