import process from "node:process";
import { SignJWT, jwtVerify } from "jose";
import { decodeBase64ToBytes } from "./base64";

export const SESSION_SUBJECT = "owner";
export const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MAX_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const MIN_SECRET_BYTES = 32;

export type StudioSession = { sub: typeof SESSION_SUBJECT };

function getSessionSecretKey(): Uint8Array {
  const secretBase64 = process.env.STUDIO_SESSION_SECRET;
  if (!secretBase64) {
    throw new Error("STUDIO_SESSION_SECRET is not configured.");
  }
  const secretBytes = decodeBase64ToBytes(secretBase64);
  if (!secretBytes || secretBytes.length < MIN_SECRET_BYTES) {
    throw new Error(
      `STUDIO_SESSION_SECRET must decode to at least ${MIN_SECRET_BYTES} bytes of base64 data.`,
    );
  }
  return secretBytes;
}

export async function createSessionToken(ttlSeconds = DEFAULT_SESSION_TTL_SECONDS): Promise<string> {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("Session TTL must be a positive integer number of seconds.");
  }
  if (ttlSeconds > MAX_SESSION_TTL_SECONDS) {
    throw new Error(`Session TTL cannot exceed the ${MAX_SESSION_TTL_SECONDS}-second maximum.`);
  }
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(SESSION_SUBJECT)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + ttlSeconds)
    .sign(getSessionSecretKey());
}

type VerifyOptions = { currentDate?: Date };

export async function verifySessionToken(
  token: unknown,
  options: VerifyOptions = {},
): Promise<StudioSession | null> {
  if (typeof token !== "string" || token.length === 0) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecretKey(), {
      algorithms: ["HS256"],
      subject: SESSION_SUBJECT,
      requiredClaims: ["sub", "iat", "exp"],
      currentDate: options.currentDate,
    });
    if (payload.sub !== SESSION_SUBJECT) return null;
    return { sub: SESSION_SUBJECT };
  } catch {
    return null;
  }
}
