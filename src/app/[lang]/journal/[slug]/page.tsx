import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getAdjacentJournalPosts, getJournalPost } from "@/content/journal";
import { getDictionary, isLocale } from "../../dictionaries";
import { JournalMarkdown } from "@/components/journal-markdown";

export const dynamicParams = true;

type JournalRouteProps = PageProps<"/[lang]/journal/[slug]">;

export async function generateMetadata({ params }: JournalRouteProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const post = getJournalPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — kotakunp`,
    description: post.excerpt,
  };
}

export default async function JournalPostPage({ params }: JournalRouteProps) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const post = getJournalPost(slug);
  if (!post) notFound();
  const copy = await getDictionary(lang);

  const adjacent = getAdjacentJournalPosts(slug);

  return (
    <main id="top">
      <SiteHeader locale={lang} active={"journal" as const} labels={copy.nav} />
      <article className="journal-article page-width">
        <header className="journal-article-header">
          <span className="tag">{post.type}</span>
          <h1>{post.title}</h1>
          <p>{post.excerpt}</p>
          <small>
            {post.publishedAt.slice(0, 10)} · {post.readingTimeMinutes} min
          </small>
        </header>
        <JournalMarkdown markdown={post.bodyMarkdown} />
        {post.tags.length > 0 ? (
          <nav className="tags journal-tags" aria-label="Tags">
            {post.tags.map((tag) => (
              <Link key={tag.slug} href={`/${lang}/journal?tag=${tag.slug}`}>
                {tag.name}
              </Link>
            ))}
          </nav>
        ) : null}
        <nav className="adjacent-nav" aria-label="More posts">
          {adjacent.previous ? (
            <Link href={`/${lang}/journal/${adjacent.previous.slug}`}>
              ← {adjacent.previous.title}
            </Link>
          ) : (
            <span />
          )}
          {adjacent.next ? (
            <Link href={`/${lang}/journal/${adjacent.next.slug}`}>
              {adjacent.next.title} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>
      <section className="page-width ruled-section journal-back">
        <Link className="text-link" href={`/${lang}/journal`}>
          {copy.nav.journal} →
        </Link>
      </section>
      <SiteFooter locale={lang} labels={copy.nav} />
    </main>
  );
}