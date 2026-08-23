import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { MusicRepository } from "@/lib/music/repository";
import { invalidateMusicCache, shouldInvalidatePublishedMusicChange } from "@/lib/music/queries";
import {
  HttpProblem,
  jsonOk,
  readCappedJson,
  requireStudioMutation,
  toErrorResponse,
} from "@/lib/studio/http";
import { requireStudioSessionFromRequest } from "@/lib/auth/request";
import { jsonError } from "@/lib/studio/http";
import { releasePatchSchema, validateReleaseForPublish } from "@/lib/music/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const session = await requireStudioSessionFromRequest(request);
    if (!session) {
      return jsonError({ code: "unauthorized", message: "Studio session required." }, 401);
    }
    const { id } = await context.params;
    const repo = new MusicRepository(getDb());
    const release = await repo.getReleaseById(id);
    if (!release) throw new HttpProblem(404, "not_found", "Release not found.");
    const tracks = await repo.listTracks(id);
    let coverAlt: string | null = null;
    let coverPath: string | null = null;
    if (release.coverMediaId) {
      const rows = await getDb()
        .select({ alt: schema.media.alt, publicPath: schema.media.publicPath })
        .from(schema.media)
        .where(eq(schema.media.id, release.coverMediaId))
        .limit(1);
      coverAlt = rows[0]?.alt ?? null;
      coverPath = rows[0]?.publicPath ?? null;
    }
    return jsonOk({ release, tracks, coverAlt, coverPath });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    await requireStudioMutation(request);
    const { id } = await context.params;
    const body = await readCappedJson(request);
    const parsed = releasePatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpProblem(400, "invalid_input", "Invalid release update.");
    }
    const patch = parsed.data;

    const db = getDb();
    const repo = new MusicRepository(db);
    const before = await repo.getReleaseById(id);
    if (!before) throw new HttpProblem(404, "not_found", "Release not found.");

    if (patch.coverMediaId) {
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
        throw new HttpProblem(422, "cover_not_image", "Release covers must be images.", {
          coverMediaId: "Must be an image",
        });
      }
    }
    if (patch.coverMediaId && patch.coverAlt !== undefined) {
      const { MediaRepository } = await import("@/lib/media/repository");
      await new MediaRepository(db).updateAlt(patch.coverMediaId, patch.coverAlt);
    }

    const effective = {
      title: patch.title ?? before.title,
      englishTitle: patch.englishTitle ?? before.englishTitle,
      slug: patch.slug ?? before.slug,
      type: patch.type ?? before.type,
      releaseDate:
        patch.releaseDate !== undefined
          ? patch.releaseDate
          : before.releaseDate
            ? before.releaseDate.toISOString()
            : null,
      descriptionMarkdown: patch.descriptionMarkdown ?? before.descriptionMarkdown,
      coverMediaId: patch.coverMediaId !== undefined ? patch.coverMediaId : before.coverMediaId,
      coverAlt:
        patch.coverAlt !== undefined
          ? patch.coverAlt
          : (
              await db
                .select({ alt: schema.media.alt })
                .from(schema.media)
                .where(eq(schema.media.id, before.coverMediaId ?? ""))
                .limit(1)
            )[0]?.alt ?? null,
    };

    const willPublish =
      patch.status === "published" ||
      (patch.status === undefined && before.status === "published");
    if (willPublish) {
      const problems = validateReleaseForPublish(effective);
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
      patch.status === "published" && !before.publishedAt ? new Date() : (before.publishedAt ?? null);
    const slugChanged = patch.slug !== undefined && patch.slug !== before.slug;
    const oldSlug = before.slug;

    try {
      await repo.updateRelease(id, {
        title: patch.title,
        englishTitle: patch.englishTitle,
        slug: patch.slug,
        type: patch.type,
        descriptionMarkdown: patch.descriptionMarkdown,
        status: patch.status,
        coverMediaId: patch.coverMediaId,
        releaseDate:
          patch.releaseDate === undefined
            ? undefined
            : patch.releaseDate === null
              ? null
              : new Date(patch.releaseDate),
        duuToUrl: patch.duuToUrl,
        youtubeUrl: patch.youtubeUrl,
        spotifyUrl: patch.spotifyUrl,
        appleMusicUrl: patch.appleMusicUrl,
        publishedAt,
        updatedAt: new Date(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        throw new HttpProblem(409, "slug_conflict", "That slug is already in use.", {
          slug: "Already in use",
        });
      }
      throw error;
    }

    const after = await repo.getReleaseById(id);
    if (
      shouldInvalidatePublishedMusicChange(
        { status: before.status, slug: before.slug },
        after ? { status: after.status, slug: after.slug } : null,
      )
    ) {
      invalidateMusicCache();
      const { revalidatePath } = await import("next/cache");
      const slugs = slugChanged ? [oldSlug, after?.slug ?? oldSlug] : [after?.slug ?? oldSlug];
      for (const locale of ["en", "ja", "mn"]) {
        revalidatePath(`/${locale}`);
        revalidatePath(`/${locale}/music`);
        for (const slug of slugs) {
          revalidatePath(`/${locale}/music/${slug}`);
        }
      }
    }

    return jsonOk({ release: after });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    await requireStudioMutation(request);
    const { id } = await context.params;
    const body = (await readCappedJson(request)) as { confirmTitle?: string };
    const repo = new MusicRepository(getDb());
    const release = await repo.getReleaseById(id);
    if (!release) throw new HttpProblem(404, "not_found", "Release not found.");
    if (body.confirmTitle !== release.title) {
      throw new HttpProblem(422, "confirm_title", "Type the exact release title to confirm deletion.", {
        confirmTitle: "Does not match the release title",
      });
    }
    const wasPublished = release.status === "published";
    const deleted = await repo.deleteRelease(id);
    if (wasPublished && deleted) {
      invalidateMusicCache();
      const { revalidatePath } = await import("next/cache");
      for (const locale of ["en", "ja", "mn"]) {
        revalidatePath(`/${locale}`);
        revalidatePath(`/${locale}/music`);
        revalidatePath(`/${locale}/music/${release.slug}`);
      }
    }
    return jsonOk({ deleted });
  } catch (error) {
    return toErrorResponse(error);
  }
}
