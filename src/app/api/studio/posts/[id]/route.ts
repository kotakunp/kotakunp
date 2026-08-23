import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { JournalRepository } from "@/lib/journal/repository";
import { invalidateJournalCache, shouldInvalidatePublishedJournalChange } from "@/lib/journal/queries";
import {
  HttpProblem,
  jsonOk,
  readCappedJson,
  requireStudioMutation,
  toErrorResponse,
} from "@/lib/studio/http";
import { requireStudioSessionFromRequest } from "@/lib/auth/request";
import { jsonError } from "@/lib/studio/http";
import { postPatchSchema, validatePostForPublish } from "@/lib/journal/validation";
import { extractReferencedMediaIds } from "@/lib/journal/media-references";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const session = await requireStudioSessionFromRequest(request);
    if (!session) {
      return jsonError({ code: "unauthorized", message: "Studio session required." }, 401);
    }
    const { id } = await context.params;
    const repo = new JournalRepository(getDb());
    const post = await repo.getPostById(id);
    if (!post) throw new HttpProblem(404, "not_found", "Post not found.");
    const tags = await repo.listTagsForPost(id);
    let coverAlt: string | null = null;
    let coverPath: string | null = null;
    if (post.coverMediaId) {
      const rows = await getDb()
        .select({ alt: schema.media.alt, publicPath: schema.media.publicPath })
        .from(schema.media)
        .where(eq(schema.media.id, post.coverMediaId))
        .limit(1);
      coverAlt = rows[0]?.alt ?? null;
      coverPath = rows[0]?.publicPath ?? null;
    }
    return jsonOk({ post, tags, coverAlt, coverPath });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    await requireStudioMutation(request);
    const { id } = await context.params;
    const body = await readCappedJson(request);
    const parsed = postPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpProblem(400, "invalid_input", "Invalid post update.");
    }
    const patch = parsed.data;

    const db = getDb();
    const repo = new JournalRepository(db);
    const before = await repo.getPostById(id);
    if (!before) throw new HttpProblem(404, "not_found", "Post not found.");

    if (patch.coverMediaId !== undefined && patch.coverMediaId !== null) {
      const media = await db
        .select({ id: schema.media.id, kind: schema.media.kind })
        .from(schema.media)
        .where(eq(schema.media.id, patch.coverMediaId))
        .limit(1);
      if (media.length === 0) {
        throw new HttpProblem(422, "unknown_media", "Cover media does not exist.", {
          coverMediaId: "Unknown media",
        });
      }
      if (media[0].kind !== "image") {
        throw new HttpProblem(422, "cover_not_image", "Post covers must be images.", {
          coverMediaId: "Must be an image",
        });
      }
    }
    if (patch.coverMediaId !== undefined && patch.coverAlt !== undefined && patch.coverMediaId) {
      await new (await import("@/lib/media/repository")).MediaRepository(db).updateAlt(
        patch.coverMediaId,
        patch.coverAlt,
      );
    }

    const effectiveCoverMediaId =
      patch.coverMediaId !== undefined ? patch.coverMediaId : before.coverMediaId;
    const effectiveCoverAlt =
      patch.coverAlt !== undefined
        ? patch.coverAlt
        : (
            await db
              .select({ alt: schema.media.alt })
              .from(schema.media)
              .where(eq(schema.media.id, effectiveCoverMediaId ?? ""))
              .limit(1)
          )[0]?.alt ?? null;
    const effective = {
      title: patch.title ?? before.title,
      excerpt: patch.excerpt ?? before.excerpt,
      type: patch.type ?? before.type,
      bodyMarkdown: patch.bodyMarkdown ?? before.bodyMarkdown,
      coverMediaId: effectiveCoverMediaId,
      coverAlt: effectiveCoverAlt,
      tags: patch.tags ?? (await repo.listTagsForPost(id)),
    };

    const willPublish =
      patch.status === "published" ||
      (patch.status === undefined && before.status === "published");
    if (willPublish) {
      const problems = validatePostForPublish(effective);
      if (problems.length > 0) {
        throw new HttpProblem(
          422,
          "publish_requirements",
          `Cannot publish: missing ${problems.join(", ")}.`,
          Object.fromEntries(problems.map((field) => [field, "Required to publish"])),
        );
      }
    }

    const publishedAt =
      patch.status === "published" && !before.publishedAt
        ? new Date()
        : (before.publishedAt ?? null);
    if (patch.status === "draft") {
      // Unpublish keeps the original publish date for republishing history.
    }

    const slugChanged = patch.slug !== undefined && patch.slug !== before.slug;
    const oldSlug = before.slug;

    const effectiveBody =
      patch.bodyMarkdown !== undefined ? patch.bodyMarkdown : before.bodyMarkdown;
    const allReferencedIds = extractReferencedMediaIds(effectiveBody);
    const knownMedia =
      allReferencedIds.length > 0
        ? await db
            .select({ id: schema.media.id })
            .from(schema.media)
            .where(
              sql`${schema.media.id} in (${sql.join(allReferencedIds.map((mid) => sql`${mid}`), sql`, `)})`,
            )
        : [];
    const knownMediaIds = new Set(knownMedia.map((row) => row.id));
    const referencedMediaIds = allReferencedIds.filter((mid) => knownMediaIds.has(mid));

    try {
      db.transaction((tx) => {
        tx
          .update(schema.journalPosts)
          .set({
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
            ...(patch.excerpt !== undefined ? { excerpt: patch.excerpt } : {}),
            ...(patch.type !== undefined ? { type: patch.type } : {}),
            ...(patch.bodyMarkdown !== undefined ? { bodyMarkdown: patch.bodyMarkdown } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.coverMediaId !== undefined ? { coverMediaId: patch.coverMediaId } : {}),
            ...(publishedAt !== undefined && publishedAt !== null ? { publishedAt } : {}),
            updatedAt: new Date(),
          })
          .where(eq(schema.journalPosts.id, id))
          .run();
        if (patch.tags) {
          new JournalRepository(tx).syncPostTags(id, patch.tags);
        }
        new JournalRepository(tx).syncPostMedia(id, referencedMediaIds);
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        throw new HttpProblem(409, "slug_conflict", "That slug is already in use.", {
          slug: "Already in use",
        });
      }
      throw error;
    }

    const after = await repo.getPostById(id);
    if (
      shouldInvalidatePublishedJournalChange(
        { status: before.status, slug: before.slug },
        after ? { status: after.status, slug: after.slug } : null,
      )
    ) {
      invalidateJournalCache();
    }
    if (slugChanged && (before.status === "published" || after?.status === "published")) {
      const { revalidatePath } = await import("next/cache");
      for (const locale of ["en", "ja", "mn"]) {
        revalidatePath(`/${locale}/journal/${oldSlug}`);
        revalidatePath(`/${locale}/journal/${after?.slug ?? oldSlug}`);
      }
    }

    return jsonOk({ post: after });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    await requireStudioMutation(request);
    const { id } = await context.params;
    const body = (await readCappedJson(request)) as { confirmTitle?: string };
    const repo = new JournalRepository(getDb());
    const post = await repo.getPostById(id);
    if (!post) throw new HttpProblem(404, "not_found", "Post not found.");
    if (body.confirmTitle !== post.title) {
      throw new HttpProblem(422, "confirm_title", "Type the exact post title to confirm deletion.", {
        confirmTitle: "Does not match the post title",
      });
    }
    const wasPublished = post.status === "published";
    const deleted = await repo.deletePost(id);
    if (wasPublished && deleted) {
      invalidateJournalCache();
      const { revalidatePath } = await import("next/cache");
      for (const locale of ["en", "ja", "mn"]) {
        revalidatePath(`/${locale}/journal/${post.slug}`);
      }
    }
    return jsonOk({ deleted });
  } catch (error) {
    return toErrorResponse(error);
  }
}
