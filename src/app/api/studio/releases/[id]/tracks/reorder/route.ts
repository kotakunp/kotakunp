import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { MusicRepository } from "@/lib/music/repository";
import {
  HttpProblem,
  jsonOk,
  readCappedJson,
  requireStudioMutation,
  toErrorResponse,
} from "@/lib/studio/http";
import { trackReorderSchema } from "@/lib/music/validation";
import { invalidateMusicCache } from "@/lib/music/queries";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    await requireStudioMutation(request);
    const { id: releaseId } = await context.params;
    const body = await readCappedJson(request);
    const parsed = trackReorderSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpProblem(400, "invalid_input", "Invalid reorder payload.");
    }

    const db = getDb();
    const repo = new MusicRepository(db);
    const release = await repo.getReleaseById(releaseId);
    if (!release) throw new HttpProblem(404, "not_found", "Release not found.");

    const existing = await repo.listTracks(releaseId);
    const existingIds = new Set(existing.map((track) => track.id));
    const orderedIds = parsed.data.trackIds;

    if (orderedIds.length !== existing.length) {
      throw new HttpProblem(422, "reorder_mismatch", "Reorder list must contain every track exactly once.");
    }
    for (const trackId of orderedIds) {
      if (!existingIds.has(trackId)) {
        throw new HttpProblem(422, "reorder_foreign", "Reorder list contains an unknown or foreign track ID.");
      }
    }
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new HttpProblem(422, "reorder_duplicate", "Reorder list contains duplicate track IDs.");
    }

    // Two-phase rewrite avoids transient (release_id, position) unique collisions.
    db.transaction((tx) => {
      orderedIds.forEach((trackId, index) => {
        tx
          .update(schema.musicTracks)
          .set({ position: -(index + 1), updatedAt: new Date() })
          .where(eq(schema.musicTracks.id, trackId))
          .run();
      });
      orderedIds.forEach((trackId, index) => {
        tx
          .update(schema.musicTracks)
          .set({ position: index + 1, updatedAt: new Date() })
          .where(eq(schema.musicTracks.id, trackId))
          .run();
      });
    });

    if (release.status === "published") {
      invalidateMusicCache();
      const { revalidatePath } = await import("next/cache");
      for (const locale of ["en", "ja", "mn"]) {
        revalidatePath(`/${locale}/music/${release.slug}`);
      }
    }

    return jsonOk({ tracks: await repo.listTracks(releaseId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
