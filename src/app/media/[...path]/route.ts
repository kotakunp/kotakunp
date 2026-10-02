import { createReadStream } from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { getDb, getContentUploadsPath } from "@/db/client";
import * as schema from "@/db/schema";
import { requireStudioSessionFromRequest } from "@/lib/auth/request";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

async function isPubliclyVisible(mediaId: string): Promise<boolean> {
  const db = getDb();
  const releaseCover = await db
    .select({ id: schema.musicReleases.id })
    .from(schema.musicReleases)
    .where(
      and(
        eq(schema.musicReleases.coverMediaId, mediaId),
        eq(schema.musicReleases.status, "published"),
      ),
    )
    .limit(1);
  if (releaseCover.length > 0) return true;

  const trackAudio = await db
    .select({ id: schema.musicTracks.id })
    .from(schema.musicTracks)
    .innerJoin(
      schema.musicReleases,
      eq(schema.musicTracks.releaseId, schema.musicReleases.id),
    )
    .where(
      and(
        eq(schema.musicTracks.audioMediaId, mediaId),
        eq(schema.musicReleases.status, "published"),
      ),
    )
    .limit(1);
  return trackAudio.length > 0;
}

function parseSingleRange(header: string, byteSize: number): { start: number; end: number } | "invalid" | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;
  if (rawStart === "") {
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return "invalid";
    const start = Math.max(0, byteSize - suffixLength);
    return { start, end: byteSize - 1 };
  }
  const start = Number(rawStart);
  if (!Number.isInteger(start) || start >= byteSize) return "invalid";
  const end = rawEnd === "" ? byteSize - 1 : Number(rawEnd);
  if (!Number.isInteger(end) || end < start || end >= byteSize) {
    return end >= byteSize ? { start, end: byteSize - 1 } : "invalid";
  }
  return { start, end };
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return serveMedia(request, context, false);
}

export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
  return serveMedia(request, context, true);
}

async function serveMedia(request: Request, context: RouteContext, headOnly: boolean): Promise<Response> {
  try {
    const { path: segments } = await context.params;
    const [mediaId, ...rest] = segments ?? [];
    if (!mediaId) {
      return new Response("Not found", { status: 404 });
    }

    const db = getDb();
    const rows = await db.select().from(schema.media).where(eq(schema.media.id, mediaId)).limit(1);
    if (rows.length === 0) {
      return new Response("Not found", { status: 404 });
    }
    const media = rows[0];

    if (media.source !== "bundled") {
      const safeName = path.basename(media.publicPath);
      if (rest.length > 0 && rest.join("/") !== safeName) {
        return new Response("Not found", { status: 404 });
      }
    }

    const public_ = media.source === "bundled" || (await isPubliclyVisible(media.id));
    if (!public_) {
      const session = await requireStudioSessionFromRequest(request);
      if (!session) {
        return new Response("Unauthorized", {
          status: 401,
          headers: { "Cache-Control": "private, no-store" },
        });
      }
    }

    const absolutePath = path.resolve(getContentUploadsPath(), media.storageKey);
    const uploadsRoot = path.resolve(getContentUploadsPath());
    if (!absolutePath.startsWith(uploadsRoot + path.sep)) {
      return new Response("Not found", { status: 404 });
    }
    let stat;
    try {
      stat = await fsp.stat(absolutePath);
    } catch {
      return new Response("Not found", { status: 404 });
    }
    if (!stat.isFile() || stat.size !== media.byteSize) {
      return new Response("Not found", { status: 404 });
    }

    const etag = `"${media.byteSize}-${Math.floor(media.createdAt.getTime())}"`;
    const baseHeaders: Record<string, string> = {
      ETag: etag,
      "Content-Type": media.mimeType,
      "Accept-Ranges": "bytes",
      "Cache-Control": public_
        ? "public, max-age=31536000, immutable"
        : "private, no-store",
    };

    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: baseHeaders });
    }

    const rangeHeader = request.headers.get("range");
    let start = 0;
    let end = stat.size - 1;
    let status = 200;
    if (rangeHeader) {
      const parsed = parseSingleRange(rangeHeader, stat.size);
      if (parsed === "invalid") {
        return new Response("Range not satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${stat.size}` },
        });
      }
      if (parsed !== null) {
        ({ start, end } = parsed);
        status = 206;
        baseHeaders["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
      }
    }
    const contentLength = end - start + 1;
    baseHeaders["Content-Length"] = String(contentLength);

    if (headOnly) {
      return new Response(null, { status, headers: baseHeaders });
    }

    const stream = createReadStream(absolutePath, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status,
      headers: baseHeaders,
    });
  } catch (error) {
    console.error(error);
    return new Response("Internal error", { status: 500 });
  }
}
