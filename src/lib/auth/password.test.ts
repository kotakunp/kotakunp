import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decodeBase64ToBytes } from "./base64";
import {
  SCRYPT_KEY_LENGTH_BYTES,
  derivePasswordHash,
  generateSalt,
  verifyConfiguredPassword,
  verifyStudioPassword,
} from "./password";

const PASSWORD = "correct horse battery staple";

function makeConfig(password: string) {
  const saltBase64 = generateSalt();
  return { saltBase64, hashBase64: derivePasswordHash(password, saltBase64)! };
}

describe("decodeBase64ToBytes", () => {
  it("decodes valid base64", () => {
    expect(Array.from(decodeBase64ToBytes("dGVzdA==")!)).toEqual(Array.from(Buffer.from("test")));
  });

  it("rejects empty, non-multiple-of-4, and non-alphabet input", () => {
    expect(decodeBase64ToBytes("")).toBeNull();
    expect(decodeBase64ToBytes("abc")).toBeNull();
    expect(decodeBase64ToBytes("a b c=")).toBeNull();
    expect(decodeBase64ToBytes("!!!!")).toBeNull();
    expect(decodeBase64ToBytes(undefined)).toBeNull();
    expect(decodeBase64ToBytes(123)).toBeNull();
  });
});

describe("verifyConfiguredPassword", () => {
  it("accepts the correct password", () => {
    const config = makeConfig(PASSWORD);
    expect(verifyConfiguredPassword(PASSWORD, config)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const config = makeConfig(PASSWORD);
    expect(verifyConfiguredPassword("wrong password", config)).toBe(false);
  });

  it("rejects a malformed configured hash", () => {
    const saltBase64 = generateSalt();
    expect(verifyConfiguredPassword(PASSWORD, { saltBase64, hashBase64: "not base64!!" })).toBe(false);
    expect(
      verifyConfiguredPassword(PASSWORD, { saltBase64, hashBase64: Buffer.from("short").toString("base64") }),
    ).toBe(false);
    expect(verifyConfiguredPassword(PASSWORD, { saltBase64, hashBase64: "" })).toBe(false);
  });

  it("rejects a malformed or undersized salt", () => {
    const config = makeConfig(PASSWORD);
    expect(verifyConfiguredPassword(PASSWORD, { ...config, saltBase64: "invalid" })).toBe(false);
    expect(
      verifyConfiguredPassword(PASSWORD, { ...config, saltBase64: Buffer.from("tiny").toString("base64") }),
    ).toBe(false);
    expect(verifyConfiguredPassword(PASSWORD, { ...config, saltBase64: "" })).toBe(false);
  });

  it("rejects an empty password without invoking scrypt", () => {
    expect(verifyConfiguredPassword("", makeConfig(PASSWORD))).toBe(false);
  });

  it("derives hashes of the configured key length", () => {
    const config = makeConfig(PASSWORD);
    expect(decodeBase64ToBytes(config.hashBase64)!.length).toBe(SCRYPT_KEY_LENGTH_BYTES);
  });

  it("produces different hashes for the same password with different salts", () => {
    expect(makeConfig(PASSWORD).hashBase64).not.toBe(makeConfig(PASSWORD).hashBase64);
  });

  it("uses random salts by default", () => {
    const saltA = generateSalt();
    const saltB = generateSalt();
    expect(saltA).not.toBe(saltB);
    expect(decodeBase64ToBytes(saltA)!.length).toBe(randomBytes(16).length);
  });
});

describe("verifyStudioPassword", () => {
  it("reads the configured environment credentials", async () => {
    const { vi } = await import("vitest");
    const config = makeConfig(PASSWORD);
    vi.stubEnv("STUDIO_PASSWORD_SALT", config.saltBase64);
    vi.stubEnv("STUDIO_PASSWORD_HASH", config.hashBase64);
    try {
      expect(verifyStudioPassword(PASSWORD)).toBe(true);
      expect(verifyStudioPassword("nope")).toBe(false);
      vi.stubEnv("STUDIO_PASSWORD_HASH", "malformed");
      expect(verifyStudioPassword(PASSWORD)).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("fails closed when credentials are missing", async () => {
    const { vi } = await import("vitest");
    vi.stubEnv("STUDIO_PASSWORD_SALT", "");
    vi.stubEnv("STUDIO_PASSWORD_HASH", "");
    try {
      expect(verifyStudioPassword(PASSWORD)).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
