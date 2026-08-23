import { rateLimit } from "@/lib/rate-limit";
import {
  assertSameOrigin,
  buildSessionClearCookie,
  buildSessionCookie,
  requireStudioSessionFromRequest,
} from "@/lib/auth/request";
import { verifyStudioPassword } from "@/lib/auth/password";
import {
  DEFAULT_SESSION_TTL_SECONDS,
  createSessionToken,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_BODY_BYTES = 1024;
const MAX_PASSWORD_LENGTH = 1024;

type SessionErrorBody = { data: null; error: { code: string; message: string } };
type SessionSuccessBody = { data: { status: string }; error: null };

function errorResponse(error: SessionErrorBody["error"], status: number, headers?: HeadersInit) {
  const body: SessionErrorBody = { data: null, error };
  return Response.json(body, { status, headers });
}

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return errorResponse({ code: "forbidden_origin", message: "Origin check failed." }, 403);
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return errorResponse({ code: "payload_too_large", message: "Request body too large." }, 413);
    }
    body = JSON.parse(rawBody || "null");
  } catch {
    return errorResponse({ code: "invalid_json", message: "Malformed request body." }, 400);
  }

  const password =
    typeof body === "object" && body !== null && typeof (body as { password?: unknown }).password === "string"
      ? (body as { password: string }).password
      : null;
  if (!password || password.length > MAX_PASSWORD_LENGTH) {
    return errorResponse(
      { code: "invalid_request", message: "A password string is required." },
      400,
    );
  }

  if (!verifyStudioPassword(password)) {
    const { ok, retryAfterSec } = rateLimit(
      `studio-login:${getClientIp(request)}`,
      LOGIN_ATTEMPT_LIMIT,
      LOGIN_WINDOW_MS,
    );
    if (!ok) {
      return errorResponse(
        { code: "rate_limited", message: "Too many failed attempts. Try again later." },
        429,
        { "Retry-After": String(retryAfterSec) },
      );
    }
    return errorResponse({ code: "invalid_credentials", message: "Incorrect password." }, 401);
  }

  const token = await createSessionToken(DEFAULT_SESSION_TTL_SECONDS);
  const successBody: SessionSuccessBody = { data: { status: "authenticated" }, error: null };
  return Response.json(successBody, {
    headers: { "Set-Cookie": buildSessionCookie(token, DEFAULT_SESSION_TTL_SECONDS) },
  });
}

export async function DELETE(request: Request) {
  if (!assertSameOrigin(request)) {
    return errorResponse({ code: "forbidden_origin", message: "Origin check failed." }, 403);
  }
  const session = await requireStudioSessionFromRequest(request);
  if (!session) {
    return errorResponse({ code: "unauthorized", message: "No active studio session." }, 401);
  }
  const successBody: SessionSuccessBody = { data: { status: "signed_out" }, error: null };
  return Response.json(successBody, {
    headers: { "Set-Cookie": buildSessionClearCookie() },
  });
}
