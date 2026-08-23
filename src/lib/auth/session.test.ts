import { encodeBytesToBase64, decodeBase64ToBytes } from "./base64";
import {
  DEFAULT_SESSION_TTL_SECONDS,
  MAX_SESSION_TTL_SECONDS,
  SESSION_SUBJECT,
  createSessionToken,
  verifySessionToken,
} from "./session";
import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET_BASE64 = encodeBytesToBase64(new Uint8Array(32).fill(7));

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubSecret(secretBase64: string) {
  vi.stubEnv("STUDIO_SESSION_SECRET", secretBase64);
}

describe("createSessionToken / verifySessionToken", () => {
  it("round-trips a signed token containing only sub, iat and exp", async () => {
    stubSecret(SECRET_BASE64);
    const before = Math.floor(Date.now() / 1000) - 1;
    const token = await createSessionToken(60);
    const payload = (await import("jose")).decodeJwt(token);
    expect(payload.sub).toBe(SESSION_SUBJECT);
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.exp! - payload.iat!).toBe(60);
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "sub"]);
    expect(await verifySessionToken(token)).toEqual({ sub: SESSION_SUBJECT });
  });

  it("defaults to the 7-day TTL", async () => {
    stubSecret(SECRET_BASE64);
    const token = await createSessionToken();
    const payload = (await import("jose")).decodeJwt(token);
    expect(payload.exp! - payload.iat!).toBe(DEFAULT_SESSION_TTL_SECONDS);
  });

  it("rejects an expired token", async () => {
    stubSecret(SECRET_BASE64);
    const token = await createSessionToken(2);
    const issuedAt = new Date();
    expect(
      await verifySessionToken(token, {
        currentDate: new Date(issuedAt.getTime() + 3_000),
      }),
    ).toBeNull();
    expect(
      await verifySessionToken(token, {
        currentDate: new Date(issuedAt.getTime() + 1_000),
      }),
    ).toEqual({ sub: SESSION_SUBJECT });
  });

  it("rejects a tampered token", async () => {
    stubSecret(SECRET_BASE64);
    const token = await createSessionToken(60);
    const segments = token.split(".");
    const payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
    payload.sub = "attacker";
    segments[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(await verifySessionToken(segments.join("."))).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    stubSecret(SECRET_BASE64);
    const token = await createSessionToken(60);
    stubSecret(encodeBytesToBase64(new Uint8Array(32).fill(9)));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects garbage and empty tokens", async () => {
    stubSecret(SECRET_BASE64);
    expect(await verifySessionToken("garbage")).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken(null)).toBeNull();
  });

  it("enforces the 7-day maximum TTL", async () => {
    stubSecret(SECRET_BASE64);
    await expect(createSessionToken(MAX_SESSION_TTL_SECONDS + 1)).rejects.toThrow(/maximum/);
    await expect(createSessionToken(0)).rejects.toThrow();
    await expect(createSessionToken(-5)).rejects.toThrow();
    await expect(createSessionToken(1.5)).rejects.toThrow();
  });
});

describe("session secret validation", () => {
  it("throws when the secret is missing", async () => {
    stubSecret("");
    await expect(createSessionToken()).rejects.toThrow(/not configured/);
  });

  it("throws when the secret is too short", async () => {
    stubSecret(encodeBytesToBase64(new Uint8Array(16)));
    await expect(createSessionToken()).rejects.toThrow(/32 bytes/);
  });

  it("throws when the secret is not valid base64", async () => {
    stubSecret("short-but-not-base64!");
    await expect(createSessionToken()).rejects.toThrow();
    expect(decodeBase64ToBytes("short-but-not-base64!")).toBeNull();
  });
});
