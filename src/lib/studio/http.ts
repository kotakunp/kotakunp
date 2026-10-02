import { assertSameOrigin, requireStudioSessionFromRequest } from "@/lib/auth/request";
import type { StudioSession } from "@/lib/auth/session";

export type ApiError = { code: string; message: string; fields?: Record<string, string> };
export type ApiResult<T> = { data: T; error: null } | { data: null; error: ApiError };

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data, error: null }, init);
}

export function jsonError(error: ApiError, status: number): Response {
  return Response.json({ data: null, error }, { status });
}

export class HttpProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function toErrorResponse(problem: unknown): Response {
  if (problem instanceof HttpProblem) {
    return jsonError(
      { code: problem.code, message: problem.message, fields: problem.fields },
      problem.status,
    );
  }
  console.error(problem);
  return jsonError({ code: "internal", message: "Unexpected server error." }, 500);
}

const MAX_JSON_BYTES = 512 * 1024;

export async function readCappedJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) {
    throw new HttpProblem(413, "payload_too_large", "JSON body too large.");
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_JSON_BYTES) {
    throw new HttpProblem(413, "payload_too_large", "JSON body too large.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpProblem(400, "invalid_json", "Body must be valid JSON.");
  }
}

export async function requireStudioMutation(
  request: Request,
): Promise<StudioSession> {
  if (!assertSameOrigin(request)) {
    throw new HttpProblem(403, "forbidden_origin", "Origin check failed.");
  }
  const session = await requireStudioSessionFromRequest(request);
  if (!session) {
    throw new HttpProblem(401, "unauthorized", "Studio session required.");
  }
  return session;
}
