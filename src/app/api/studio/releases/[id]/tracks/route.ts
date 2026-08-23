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
import { trackCreateSchema, validateTrackAudioConsistency } from "@/lib/music/validation";
import { invalidateMusicCache } from "@/lib/music/queries";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    await requireStudioMutation(request);
    const { id: releaseId } = await context.params;
    const body = await readCappedJson(request);
    const parsed = trackCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpProblem(400, "invalid_input", "Invalid track.");
    }
    const input = parsed.data;

    const db = getDb();
    const repo = new MusicRepository(db);
    const release = await repo.getReleaseById(releaseId);
    if (!release) throw new HttpProblem(404, "not_found", "Release not found.");

    const audioKind = input.audioKind ?? "none";
    if (!validateTrackAudioConsistency(audioKind, input.audioMediaId)) {
      throw new HttpProblem(422, "audio_kind_mismatch", "A track with audio must reference an uploaded audio file; a track without audio must be kind 'none'.", {
        audioKind: "Inconsistent with audio file",
      });
    }
    let durationMs: number | null = null;
    if (input.audioMediaId) {
      const mediaRepo = new MediaRepository(db);
      const media = await mediaRepo.getMediaById(input.audioMediaId);
      if (!media || media.kind !== "audio") {
        throw new HttpProblem(422, "unknown_media", "Audio media does not exist.", {
          audioMediaId: "Unknown audio media",
        });
      }
      durationMs = media.durationMs ?? null;
    }

    const existing = await repo.listTracks(releaseId);
    const created = await repo.createTrack(releaseId, {
      id: crypto.randomUUID(),
      position: existing.length + 1,
      title: input.title,
      englishTitle: input.englishTitle ?? null,
      lyricsMarkdown: input.lyricsMarkdown ?? null,
      audioMediaId: input.audioMediaId ?? null,
      audioKind,
      durationMs,
    });

    if (release.status === "published") {
      invalidateMusicCache();
      const { revalidatePath } = await import("next/cache");
      for (const locale of ["en", "ja", "mn"]) {
        revalidatePath(`/${locale}/music/${release.slug}`);
      }
    }
    return jsonOk({ track: created }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
