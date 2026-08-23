import { and, desc, eq, isNotNull, lte, or, sql } from "drizzle-orm";
import { unstable_cache, revalidateTag } from "next/cache";
import { getDb } from "@/db/client";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";

export const JOURNAL_CACHE_TAG = "journal";
const JOURNAL_REVALIDATE_SECONDS = 3600;
const READING_TIME_WPM = 220;

export type JournalTagView = { name: string; slug: string };

export type PublishedPostView = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  type: string;
  bodyMarkdown: string;
  coverPath: string | null;
  coverAlt: string | null;
  publishedAt: string;
  updatedAt: string;
  tags: JournalTagView[];
  readingTimeMinutes: number;
};

export type AdjacentPostsView = {
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

export function countMarkdownWords(markdown: string): number {
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, " ");
  const withoutDirectives = withoutFences.replace(
    /::[a-z]+\[[^\]]*\]\{[^}]*\}/g,
    " ",
  );
  const withoutImages = withoutDirectives.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  const withoutLinkSyntax = withoutImages.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  const matches = withoutLinkSyntax.match(/[^\s]+/g);
  return matches ? matches.length : 0;
}

export function readingTimeMinutes(markdown: string): number {
  const words = countMarkdownWords(markdown);
  return Math.max(1, Math.ceil(words / READING_TIME_WPM));
}

function publishedPostFilter() {
  const now = new Date();
  return and(
    eq(schema.journalPosts.status, "published"),
    isNotNull(schema.journalPosts.publishedAt),
    lte(schema.journalPosts.publishedAt, now),
  );
}

export async function listPublishedPostsQuery(
  db: Db,
  tagSlug?: string,
): Promise<PublishedPostView[]> {
  let tagId: string | null = null;
  if (tagSlug !== undefined) {
    const tag = await db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.slug, tagSlug))
      .limit(1);
    if (tag.length === 0) return [];
    tagId = tag[0].id;
  }

  const rows = await db
    .selectDistinct({
      id: schema.journalPosts.id,
      slug: schema.journalPosts.slug,
      title: schema.journalPosts.title,
      excerpt: schema.journalPosts.excerpt,
      type: schema.journalPosts.type,
      bodyMarkdown: schema.journalPosts.bodyMarkdown,
      coverMediaId: schema.journalPosts.coverMediaId,
      publishedAt: schema.journalPosts.publishedAt,
      updatedAt: schema.journalPosts.updatedAt,
    })
    .from(schema.journalPosts)
    .leftJoin(
      schema.journalPostTags,
      eq(schema.journalPostTags.postId, schema.journalPosts.id),
    )
    .where(
      tagId === null
        ? publishedPostFilter()
        : and(publishedPostFilter(), eq(schema.journalPostTags.tagId, tagId)),
    )
    .orderBy(desc(schema.journalPosts.publishedAt), desc(schema.journalPosts.id));

  if (rows.length === 0) return [];

  const covers = await resolveCoverMap(
    db,
    rows.map((row) => row.coverMediaId),
  );
  const tagRows = await db
    .select({
      postId: schema.journalPostTags.postId,
      name: schema.tags.name,
      slug: schema.tags.slug,
    })
    .from(schema.journalPostTags)
    .innerJoin(schema.tags, eq(schema.journalPostTags.tagId, schema.tags.id))
    .where(
      sql`${schema.journalPostTags.postId} in (${sql.join(
        rows.map((row) => sql`${row.id}`),
        sql`, `,
      )})`,
    );

  return rows.map((row) => {
    const cover = row.coverMediaId ? covers.get(row.coverMediaId) : undefined;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      type: row.type,
      bodyMarkdown: row.bodyMarkdown,
      coverPath: cover?.publicPath ?? null,
      coverAlt: cover?.alt ?? null,
      publishedAt: toIso(row.publishedAt),
      updatedAt: toIso(row.updatedAt),
      tags: tagRows
        .filter((tagRow) => tagRow.postId === row.id)
        .map((tagRow) => ({ name: tagRow.name, slug: tagRow.slug })),
      readingTimeMinutes: readingTimeMinutes(row.bodyMarkdown),
    };
  });
}

export async function getPublishedPostQuery(
  db: Db,
  slug: string,
): Promise<PublishedPostView | null> {
  const rows = await db
    .select()
    .from(schema.journalPosts)
    .where(and(eq(schema.journalPosts.slug, slug), publishedPostFilter()))
    .limit(1);
  if (rows.length === 0) return null;

  const post = rows[0];
  const cover = post.coverMediaId
    ? (
        await resolveCoverMap(db, [post.coverMediaId])
      ).get(post.coverMediaId)
    : undefined;
  const tagRows = await db
    .select({ name: schema.tags.name, slug: schema.tags.slug })
    .from(schema.journalPostTags)
    .innerJoin(schema.tags, eq(schema.journalPostTags.tagId, schema.tags.id))
    .where(eq(schema.journalPostTags.postId, post.id));

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    type: post.type,
    bodyMarkdown: post.bodyMarkdown,
    coverPath: cover?.publicPath ?? null,
    coverAlt: cover?.alt ?? null,
    publishedAt: toIso(post.publishedAt),
    updatedAt: toIso(post.updatedAt),
    tags: tagRows,
    readingTimeMinutes: readingTimeMinutes(post.bodyMarkdown),
  };
}

export async function getAdjacentPublishedPostsQuery(
  db: Db,
  publishedAt: string,
  id: string,
): Promise<AdjacentPostsView> {
  const anchorMs = new Date(publishedAt).getTime();
  const older = await db
    .select({ slug: schema.journalPosts.slug, title: schema.journalPosts.title })
    .from(schema.journalPosts)
    .where(
      and(
        publishedPostFilter(),
        or(
          sql`${schema.journalPosts.publishedAt} < ${anchorMs}`,
          and(
            eq(schema.journalPosts.publishedAt, new Date(publishedAt)),
            sql`${schema.journalPosts.id} < ${id}`,
          ),
        ),
      ),
    )
    .orderBy(desc(schema.journalPosts.publishedAt), desc(schema.journalPosts.id))
    .limit(1);

  const newer = await db
    .select({ slug: schema.journalPosts.slug, title: schema.journalPosts.title })
    .from(schema.journalPosts)
    .where(
      and(
        publishedPostFilter(),
        or(
          sql`${schema.journalPosts.publishedAt} > ${anchorMs}`,
          and(
            eq(schema.journalPosts.publishedAt, new Date(publishedAt)),
            sql`${schema.journalPosts.id} > ${id}`,
          ),
        ),
      ),
    )
    .orderBy(schema.journalPosts.publishedAt, schema.journalPosts.id)
    .limit(1);

  return {
    previous: older[0] ?? null,
    next: newer[0] ?? null,
  };
}

export async function listPublishedTagsQuery(
  db: Db,
): Promise<JournalTagView[]> {
  const rows = await db
    .selectDistinct({
      name: schema.tags.name,
      slug: schema.tags.slug,
    })
    .from(schema.tags)
    .innerJoin(
      schema.journalPostTags,
      eq(schema.journalPostTags.tagId, schema.tags.id),
    )
    .innerJoin(
      schema.journalPosts,
      eq(schema.journalPostTags.postId, schema.journalPosts.id),
    )
    .where(publishedPostFilter())
    .orderBy(schema.tags.slug);
  return rows;
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
    .where(sql`${schema.media.id} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
  for (const row of rows) {
    map.set(row.id, { publicPath: row.publicPath, alt: row.alt });
  }
  return map;
}

export type JournalChangeSnapshot = {
  status: "draft" | "published";
  slug: string;
} | null;

export function shouldInvalidatePublishedJournalChange(
  before: JournalChangeSnapshot,
  after: JournalChangeSnapshot,
): boolean {
  const beforePublic = before?.status === "published";
  const afterPublic = after?.status === "published";
  return beforePublic || afterPublic;
}

export async function listPublishedPosts(
  tagSlug?: string,
): Promise<PublishedPostView[]> {
  const cached = unstable_cache(
    () => listPublishedPostsQuery(getDb(), tagSlug),
    ["journal", "posts", tagSlug ?? "all"],
    { tags: [JOURNAL_CACHE_TAG], revalidate: JOURNAL_REVALIDATE_SECONDS },
  );
  return cached();
}

export async function getPublishedPost(
  slug: string,
): Promise<PublishedPostView | null> {
  const cached = unstable_cache(
    () => getPublishedPostQuery(getDb(), slug),
    ["journal", "post", slug],
    { tags: [JOURNAL_CACHE_TAG], revalidate: JOURNAL_REVALIDATE_SECONDS },
  );
  return cached();
}

export async function getAdjacentPublishedPosts(
  publishedAt: string,
  id: string,
): Promise<AdjacentPostsView> {
  const cached = unstable_cache(
    () => getAdjacentPublishedPostsQuery(getDb(), publishedAt, id),
    ["journal", "adjacent", id],
    { tags: [JOURNAL_CACHE_TAG], revalidate: JOURNAL_REVALIDATE_SECONDS },
  );
  return cached();
}

export async function listPublishedTags(): Promise<JournalTagView[]> {
  const cached = unstable_cache(() => listPublishedTagsQuery(getDb()), ["journal", "tags"], {
    tags: [JOURNAL_CACHE_TAG],
    revalidate: JOURNAL_REVALIDATE_SECONDS,
  });
  return cached();
}

export function invalidateJournalCache(): void {
  try {
    revalidateTag(JOURNAL_CACHE_TAG, { expire: 0 });
  } catch (error) {
    // Outside a Next request/render context (scripts, tests) there is no
    // static-generation store; the fallback TTL expires the cache anyway.
    console.warn("Cache invalidation skipped:", error instanceof Error ? error.message : error);
  }
}
