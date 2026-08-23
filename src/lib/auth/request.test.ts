import { encodeBytesToBase64 } from "./base64";
import {
  SESSION_COOKIE_NAME_DEVELOPMENT,
  SESSION_COOKIE_NAME_PRODUCTION,
  assertSameOrigin,
  buildSessionClearCookie,
  buildSessionCookie,
  getExpectedOrigin,
  getSessionCookieName,
  getTokenFromRequest,
  requireStudioSessionFromRequest,
} from "./request";
import { createSessionToken } from "./session";
import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET_BASE64 = encodeBytesToBase64(new Uint8Array(32).fill(3));

afterEach(() => {
  vi.unstubAllEnvs();
});

function requestWithCookieHeader(cookieHeader: string | null): Request {
  const headers = new Headers();
  if (cookieHeader !== null) headers.set("cookie", cookieHeader);
  return new Request("https://kotakunp.example/studio", { headers });
}

describe("cookie naming and flags", () => {
  it("uses the __Host- name with Secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getSessionCookieName()).toBe(SESSION_COOKIE_NAME_PRODUCTION);
    expect(getSessionCookieName()).toBe("__Host-kotakunp-studio");
    const cookie = buildSessionCookie("token-value", 3600);
    expect(cookie).toContain("__Host-kotakunp-studio=token-value;");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=3600");
  });

  it("uses a clearly named non-Host variant without Secure outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getSessionCookieName()).toBe(SESSION_COOKIE_NAME_DEVELOPMENT);
    expect(getSessionCookieName()).not.toMatch(/^__Host-/);
    const cookie = buildSessionCookie("token-value", 60);
    expect(cookie).toContain(`${SESSION_COOKIE_NAME_DEVELOPMENT}=token-value;`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Secure");
  });

  it("clears the cookie with an empty value and Max-Age=0", () => {
    for (const nodeEnv of ["production", "development"]) {
      vi.stubEnv("NODE_ENV", nodeEnv);
      const cookie = buildSessionClearCookie();
      expect(cookie).toContain(`=;`);
      expect(cookie).toContain("Max-Age=0");
      expect(cookie).toContain("HttpOnly");
    }
  });
});

describe("getTokenFromRequest", () => {
  it("parses the session token from a multi-cookie header", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      getTokenFromRequest(requestWithCookieHeader("other=a; kotakunp-studio-dev=tok.en.sig; more=b")),
    ).toBe("tok.en.sig");
    expect(getTokenFromRequest(requestWithCookieHeader(null))).toBeNull();
    expect(getTokenFromRequest(requestWithCookieHeader("kotakunp-studio-dev="))).toBeNull();
    expect(getTokenFromRequest(requestWithCookieHeader("kotakunp-studio-dev"))).toBeNull();
    vi.unstubAllEnvs();
  });
});

describe("requireStudioSessionFromRequest", () => {
  it("accepts a valid signed session cookie", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STUDIO_SESSION_SECRET", SECRET_BASE64);
    const token = await createSessionToken(60);
    const request = new Request("https://kotakunp.example/studio", {
      headers: { cookie: `kotakunp-studio-dev=${token}` },
    });
    expect(await requireStudioSessionFromRequest(request)).toEqual({ sub: "owner" });
  });

  it.each([
    ["missing cookie", null],
    ["garbage token", "kotakunp-studio-dev=garbage"],
    ["wrong cookie name", `unrelated=1`],
  ])("returns null on %s", async (_label, cookie) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STUDIO_SESSION_SECRET", SECRET_BASE64);
    expect(await requireStudioSessionFromRequest(requestWithCookieHeader(cookie))).toBeNull();
  });
});

describe("assertSameOrigin", () => {
  function requestWithOrigin(origin: string | null): Request {
    const headers = new Headers();
    if (origin) headers.set("origin", origin);
    return new Request("https://kotakunp.example/api/studio/session", {
      method: "POST",
      headers,
    });
  }

  it("matches the configured site URL origin exactly", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000/");
    expect(getExpectedOrigin()).toBe("http://localhost:3000");
    expect(assertSameOrigin(requestWithOrigin("http://localhost:3000"))).toBe(true);
  });

  it.each([
    ["foreign origin", "https://evil.example"],
    ["similar host", "http://localhost:3000.evil.example"],
    ["different port", "http://localhost:4000"],
    ["missing origin", null],
  ])("rejects %s", (_label, origin) => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    expect(assertSameOrigin(requestWithOrigin(origin))).toBe(false);
  });

  it("fails closed when NEXT_PUBLIC_SITE_URL is missing or invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(assertSameOrigin(requestWithOrigin("http://localhost:3000"))).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not-a-url");
    expect(assertSameOrigin(requestWithOrigin("http://localhost:3000"))).toBe(false);
  });
});
