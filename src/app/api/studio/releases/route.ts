import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { MusicRepository } from "@/lib/music/repository";
import {
  HttpProblem,
  jsonOk,
  readCappedJson,
  requireStudioMutation,
  toErrorResponse,
} from "@/lib/studio/http";
import { requireStudioSessionFromRequest } from "@/lib/auth/request";
import { jsonError } from "@/lib/studio/http";
import { releaseDraftCreateSchema } from "@/lib/music/validation";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireStudioSessionFromRequest(request);
    if (!session) {
      return jsonError({ code: "unauthorized", message: "Studio session required." }, 401);
    }
    const repo = new MusicRepository(getDb());
    return jsonOk({ releases: await repo.listReleases() });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireStudioMutation(request);
    const body = await readCappedJson(request);
    const parsed = releaseDraftCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpProblem(400, "invalid_input", "Invalid release draft.");
    }

    const repo = new MusicRepository(getDb());
    const slugCandidate =
      (parsed.data.englishTitle ?? parsed.data.title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 160) || `release-${randomUUID().slice(0, 8)}`;

    try {
      const created = await repo.createRelease({
        id: randomUUID(),
        slug: slugCandidate,
        title: parsed.data.title,
        englishTitle: parsed.data.englishTitle ?? "",
      });
      return jsonOk({ release: created }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        throw new HttpProblem(409, "slug_conflict", "That slug is already in use.", {
          slug: "Already in use",
        });
      }
      throw error;
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}
