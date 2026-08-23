import { createWriteStream } from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { getDb, getContentUploadsPath } from "@/db/client";
import { MediaRepository } from "@/lib/media/repository";
import {
  HttpProblem,
  jsonOk,
  requireStudioMutation,
  toErrorResponse,
} from "@/lib/studio/http";
import { requireStudioSessionFromRequest } from "@/lib/auth/request";
import { jsonError } from "@/lib/studio/http";

export const runtime = "nodejs";

const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const AUDIO_MIME_EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
};
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_AUDIO_BYTES = 150 * 1024 * 1024;

function sanitizeDisplayName(rawName: string): string {
  const base = path.basename(rawName).replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return base.length > 0 ? base.slice(0, 120) : "file";
}

async function readBodyToTempFile(
  request: Request,
  maxBytes: number,
): Promise<{ tempPath: string; byteSize: number }> {
  if (!request.body) {
    throw new HttpProblem(400, "missing_body", "Request body is required.");
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpProblem(413, "payload_too_large", `File exceeds the ${maxBytes} byte limit.`);
  }
  const tempDir = getContentUploadsPath();
  await fsp.mkdir(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, `.incoming-${randomUUID()}`);
  let byteSize = 0;
  const nodeSource = Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]);
  const countingTransform = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      byteSize += chunk.length;
      if (byteSize > maxBytes) {
        callback(new HttpProblem(413, "payload_too_large", `File exceeds the ${maxBytes} byte limit.`));
        return;
      }
      callback(null, chunk);
    },
  });
  try {
    await pipeline(nodeSource, countingTransform, createWriteStream(tempPath));
  } catch (error) {
    await fsp.rm(tempPath, { force: true });
    if (error instanceof HttpProblem) throw error;
    throw new HttpProblem(400, "upload_failed", "Could not read the uploaded stream.");
  }
  return { tempPath, byteSize };
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireStudioMutation(request);

    const rawKind = request.headers.get("x-file-kind") ?? "";
    const kind = rawKind === "image" || rawKind === "audio" ? rawKind : null;
    const displayName = sanitizeDisplayName(request.headers.get("x-file-name") ?? "file");
    if (!kind) {
      throw new HttpProblem(400, "invalid_kind", "x-file-kind must be 'image' or 'audio'.");
    }
    const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;

    const { tempPath, byteSize } = await readBodyToTempFile(request, maxBytes);
    if (byteSize === 0) {
      await fsp.rm(tempPath, { force: true });
      throw new HttpProblem(400, "empty_file", "Uploaded file is empty.");
    }

    let mimeType: string | undefined;
    let width: number | null = null;
    let height: number | null = null;
    let durationMs: number | null = null;
    try {
      const { fileTypeFromFile } = await import("file-type");
      const detected = await fileTypeFromFile(tempPath);
      mimeType = detected?.mime;
      if (!mimeType || !(mimeType in (kind === "image" ? IMAGE_MIME_EXTENSIONS : AUDIO_MIME_EXTENSIONS))) {
        throw new HttpProblem(
          415,
          "unsupported_type",
          mimeType ? `File type ${mimeType} is not an allowed ${kind} format.` : "Unrecognized file type.",
        );
      }
      if (kind === "image") {
        const sharpModule = await import("sharp").catch(() => null);
        if (sharpModule) {
          const metadata = await sharpModule.default(tempPath).metadata();
          width = metadata.width ?? null;
          height = metadata.height ?? null;
        }
      } else {
        const mm = await import("music-metadata");
        const metadata = await mm.parseFile(tempPath, { duration: true });
        const seconds = metadata.format.duration;
        if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
          throw new HttpProblem(415, "unreadable_audio", "Audio duration could not be determined.");
        }
        durationMs = Math.round(seconds * 1000);
      }
    } catch (error) {
      await fsp.rm(tempPath, { force: true });
      if (error instanceof HttpProblem) throw error;
      throw new HttpProblem(415, "unsupported_type", "File could not be identified.");
    }

    const extension =
      kind === "image"
        ? IMAGE_MIME_EXTENSIONS[mimeType]
        : AUDIO_MIME_EXTENSIONS[mimeType];
    const id = randomUUID();
    const storageKey = `${kind === "image" ? "images" : "audio"}/${id}.${extension}`;
    const finalPath = path.join(getContentUploadsPath(), storageKey);
    await fsp.mkdir(path.dirname(finalPath), { recursive: true });

    const db = getDb();
    const repo = new MediaRepository(db);
    let mediaRow;
    try {
      await fsp.rename(tempPath, finalPath);
      mediaRow = await repo.createMedia({
        id,
        kind,
        originalName: displayName,
        storageKey,
        publicPath: `/media/${id}/${displayName}`,
        mimeType,
        byteSize,
        alt: null,
        durationMs,
        width,
        height,
        source: "upload",
      });
    } catch (error) {
      await fsp.rm(finalPath, { force: true });
      await fsp.rm(tempPath, { force: true });
      throw error;
    }

    return jsonOk({ media: mediaRow }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireStudioSessionFromRequest(request);
    if (!session) {
      return jsonError({ code: "unauthorized", message: "Studio session required." }, 401);
    }
    const repo = new MediaRepository(getDb());
    return jsonOk({ media: await repo.listRecentMedia(50) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
