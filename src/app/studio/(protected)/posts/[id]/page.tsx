import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { JournalRepository } from "@/lib/journal/repository";
import { PostEditor } from "@/components/studio/post-editor";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const repo = new JournalRepository(db);
  const post = await repo.getPostById(id);
  if (!post) return <p className="studio-page">Post not found.</p>;
  const tags = await repo.listTagsForPost(id);

  let coverAlt: string | null = null;
  if (post.coverMediaId) {
    const rows = await db
      .select({ alt: schema.media.alt })
      .from(schema.media)
      .where(eq(schema.media.id, post.coverMediaId))
      .limit(1);
    coverAlt = rows[0]?.alt ?? null;
  }

  return (
    <PostEditor
      post={{
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        type: post.type,
        bodyMarkdown: post.bodyMarkdown,
        status: post.status,
        coverMediaId: post.coverMediaId,
      }}
      initialTags={tags.map((tag) => ({ name: tag.name, slug: tag.slug }))}
      initialCoverAlt={coverAlt}
    />
  );
}
