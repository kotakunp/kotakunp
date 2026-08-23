import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { JournalRepository } from "@/lib/journal/repository";
import {
  HttpProblem,
  jsonOk,
  readCappedJson,
  requireStudioMutation,
  toErrorResponse,
} from "@/lib/studio/http";
import { requireStudioSessionFromRequest } from "@/lib/auth/request";
import { jsonError } from "@/lib/studio/http";
import { postDraftCreateSchema } from "@/lib/journal/validation";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireStudioSessionFromRequest(request);
    if (!session) {
      return jsonError({ code: "unauthorized", message: "Studio session required." }, 401);
    }
    const repo = new JournalRepository(getDb());
    return jsonOk({ posts: await repo.listPosts() });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireStudioMutation(request);
    const body = await readCappedJson(request);
    const parsed = postDraftCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpProblem(400, "invalid_input", "Invalid post draft.", {
        title: parsed.error.issues[0]?.message ?? "Invalid title",
      });
    }

    const repo = new JournalRepository(getDb());
    const slugCandidate =
      parsed.data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 160) || `post-${randomUUID().slice(0, 8)}`;

    try {
      const created = await repo.createPost({
        id: randomUUID(),
        slug: slugCandidate,
        title: parsed.data.title,
      });
      return jsonOk({ post: created }, { status: 201 });
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
