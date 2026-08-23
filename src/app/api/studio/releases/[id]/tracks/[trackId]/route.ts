import { getDb } from "@/db/client";
import { MediaRepository } from "@/lib/media/repository";
import { MusicRepository } from "@/lib/music/repository";
import {
  HttpProblem,
  jsonOk,
  readCappedJson,
  requireStudioMutation,
  toErrorResponse,
} from "@/lib/studio/http";
import { trackPatchSchema, validateTrackAudioConsistency } from "@/lib/music/validation";
import { invalidateMusicCache } from "@/lib/music/queries";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; trackId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    await requireStudioMutation(request);
    const { id: releaseId, trackId } = await context.params;
    const body = await readCappedJson(request);
    const parsed = trackPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpProblem(400, "invalid_input", "Invalid track update.");
    }
    const patch = parsed.data;

    const db = getDb();
    const repo = new MusicRepository(db);
    const release = await repo.getReleaseById(releaseId);
    if (!release) throw new HttpProblem(404, "not_found", "Release not found.");
    const track = await repo.getTrackById(trackId);
    if (!track || track.releaseId !== releaseId) {
      throw new HttpProblem(404, "not_found", "Track not found on this release.");
    }

    const audioKind = patch.audioKind ?? track.audioKind;
    const audioMediaId = patch.audioMediaId !== undefined ? patch.audioMediaId : track.audioMediaId;
    if (!validateTrackAudioConsistency(audioKind, audioMediaId)) {
      throw new HttpProblem(422, "audio_kind_mismatch", "A track with audio must reference an uploaded audio file; a track without audio must be kind 'none'.", {
        audioKind: "Inconsistent with audio file",
      });
    }
    let durationMs: number | null | undefined = undefined;
    if (patch.audioMediaId !== undefined && patch.audioMediaId !== null) {
      const mediaRepo = new MediaRepository(db);
      const media = await mediaRepo.getMediaById(patch.audioMediaId);
      if (!media || media.kind !== "audio") {
        throw new HttpProblem(422, "unknown_media", "Audio media does not exist.", {
          audioMediaId: "Unknown audio media",
        });
      }
      durationMs = media.durationMs ?? null;
    } else if (patch.audioMediaId === null) {
      durationMs = null;
    }

    const updated = await repo.updateTrack(trackId, {
      title: patch.title,
      englishTitle: patch.englishTitle,
      lyricsMarkdown: patch.lyricsMarkdown,
      audioMediaId: patch.audioMediaId,
      audioKind: patch.audioKind,
      durationMs,
      updatedAt: new Date(),
    });

    if (release.status === "published") {
      invalidateMusicCache();
      const { revalidatePath } = await import("next/cache");
      for (const locale of ["en", "ja", "mn"]) {
        revalidatePath(`/${locale}/music/${release.slug}`);
      }
    }
    return jsonOk({ track: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    await requireStudioMutation(request);
    const { id: releaseId, trackId } = await context.params;
    const repo = new MusicRepository(getDb());
    const release = await repo.getReleaseById(releaseId);
    if (!release) throw new HttpProblem(404, "not_found", "Release not found.");
    const track = await repo.getTrackById(trackId);
    if (!track || track.releaseId !== releaseId) {
      throw new HttpProblem(404, "not_found", "Track not found on this release.");
    }
    const deleted = await repo.deleteTrack(trackId);

    if (release.status === "published") {
      invalidateMusicCache();
      const { revalidatePath } = await import("next/cache");
      for (const locale of ["en", "ja", "mn"]) {
        revalidatePath(`/${locale}/music/${release.slug}`);
      }
    }
    return jsonOk({ deleted });
  } catch (error) {
    return toErrorResponse(error);
  }
}
