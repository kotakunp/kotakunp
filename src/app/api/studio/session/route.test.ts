import { encodeBytesToBase64 } from "@/lib/auth/base64";
import { derivePasswordHash, generateSalt } from "@/lib/auth/password";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME_DEVELOPMENT } from "@/lib/auth/request";
import { DELETE, POST } from "./route";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
});

const PASSWORD = "studio test passphrase";
const SALT_BASE64 = generateSalt();
const HASH_BASE64 = derivePasswordHash(PASSWORD, SALT_BASE64)!;
const SECRET_BASE64 = encodeBytesToBase64(new Uint8Array(32).fill(11));

vi.stubEnv("STUDIO_PASSWORD_SALT", SALT_BASE64);
vi.stubEnv("STUDIO_PASSWORD_HASH", HASH_BASE64);
vi.stubEnv("STUDIO_SESSION_SECRET", SECRET_BASE64);

afterAll(() => {
  vi.unstubAllEnvs();
});

function loginRequest(options: {
  password?: unknown;
  origin?: string | null;
  ip?: string;
  rawBody?: string;
}): Request {
  const headers = new Headers({ "x-forwarded-for": options.ip ?? "203.0.113.1" });
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? "http://localhost:3000");
  }
  const body =
    options.rawBody ?? (options.password === undefined ? "{}" : JSON.stringify({ password: options.password }));
  return new Request("http://localhost:3000/api/studio/session", {
    method: "POST",
    headers,
    body,
  });
}

function logoutRequest(options: { cookie?: string; origin?: string | null } = {}): Request {
  const headers = new Headers();
  headers.set("x-forwarded-for", "203.0.113.9");
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? "http://localhost:3000");
  }
  if (options.cookie) headers.set("cookie", options.cookie);
  return new Request("http://localhost:3000/api/studio/session", {
    method: "DELETE",
    headers,
  });
}

async function loginAndGetCookie(password = PASSWORD): Promise<string> {
  const response = await POST(loginRequest({ password, ip: `${Math.random()}` }));
  return response.headers.get("set-cookie")!;
}

describe("POST /api/studio/session", () => {
  it("sets the session cookie on a correct password", async () => {
    const response = await POST(loginRequest({ password: PASSWORD }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ data: { status: "authenticated" }, error: null });
    const setCookie = response.headers.get("set-cookie")!;
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME_DEVELOPMENT}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).not.toContain("Secure");
    const token = setCookie.split(";")[0].split("=").slice(1).join("=");
    expect(await verifySessionToken(token)).toEqual({ sub: "owner" });
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain(PASSWORD);
    expect(setCookie).not.toContain(encodeURIComponent(PASSWORD));
    expect(setCookie).not.toContain(PASSWORD);
  });

  it("rejects a wrong password with 401", async () => {
    const response = await POST(loginRequest({ password: "definitely wrong", ip: "198.51.100.1" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      data: null,
      error: { code: "invalid_credentials", message: expect.any(String) },
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("returns 400 for missing, non-string, or malformed bodies", async () => {
    expect((await POST(loginRequest({}))).status).toBe(400);
    expect((await POST(loginRequest({ password: 42 }))).status).toBe(400);
    expect((await POST(loginRequest({ rawBody: "{not json" }))).status).toBe(400);
  });

  it("returns 403 when the Origin does not exactly match", async () => {
    for (const origin of ["https://evil.example", "http://localhost:4000"]) {
      const response = await POST(loginRequest({ password: PASSWORD, origin }));
      expect(response.status).toBe(403);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
        "forbidden_origin",
      );
    }
    const missingOrigin = await POST(loginRequest({ password: PASSWORD, origin: null }));
    expect(missingOrigin.status).toBe(403);
  });

  it("rate-limits repeated failed attempts per IP", async () => {
    const ip = "192.0.2.77";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(loginRequest({ password: `wrong-${attempt}`, ip }));
      expect(response.status).toBe(401);
    }
    const blocked = await POST(loginRequest({ password: `wrong-6`, ip }));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    const otherIp = await POST(loginRequest({ password: `wrong-6`, ip: "192.0.2.78" }));
    expect(otherIp.status).toBe(401);
  });
});

describe("DELETE /api/studio/session", () => {
  it("requires a valid session cookie", async () => {
    const unauthorized = await DELETE(logoutRequest());
    expect(unauthorized.status).toBe(401);
    const forged = await DELETE(logoutRequest({ cookie: `${SESSION_COOKIE_NAME_DEVELOPMENT}=garbage` }));
    expect(forged.status).toBe(401);
  });

  it("clears the cookie for an authenticated session", async () => {
    const setCookie = await loginAndGetCookie();
    const token = setCookie.split(";")[0].split("=").slice(1).join("=");
    const response = await DELETE(logoutRequest({ cookie: `${SESSION_COOKIE_NAME_DEVELOPMENT}=${token}` }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { status: "signed_out" }, error: null });
    const cleared = response.headers.get("set-cookie")!;
    expect(cleared).toContain(`${SESSION_COOKIE_NAME_DEVELOPMENT}=;`);
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("HttpOnly");
  });

  it("returns 403 on a foreign Origin", async () => {
    const response = await DELETE(logoutRequest({ origin: "https://evil.example" }));
    expect(response.status).toBe(403);
  });
});
