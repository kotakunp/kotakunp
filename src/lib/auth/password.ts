import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import process from "node:process";
import { decodeBase64ToBytes, encodeBytesToBase64 } from "./base64";

export const SCRYPT_KEY_LENGTH_BYTES = 64;
export const SCRYPT_COST = 16384;
export const SCRYPT_BLOCK_SIZE = 8;
export const SCRYPT_PARALLELIZATION = 1;

const MIN_SALT_BYTES = 8;

export type PasswordConfig = { saltBase64: string; hashBase64: string };

export function generateSalt(): string {
  return encodeBytesToBase64(randomBytes(16));
}

function scryptOptions(): { N: number; r: number; p: number } {
  return {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  };
}

export function derivePasswordHash(password: string, saltBase64: string): string | null {
  const salt = decodeBase64ToBytes(saltBase64);
  if (!salt) return null;
  return encodeBytesToBase64(scryptSync(password, salt, SCRYPT_KEY_LENGTH_BYTES, scryptOptions()));
}

export function verifyConfiguredPassword(password: string, config: PasswordConfig): boolean {
  if (typeof password !== "string" || password.length === 0) return false;
  const salt = decodeBase64ToBytes(config.saltBase64);
  const expectedHash = decodeBase64ToBytes(config.hashBase64);
  if (!salt || salt.length < MIN_SALT_BYTES) return false;
  if (!expectedHash || expectedHash.length !== SCRYPT_KEY_LENGTH_BYTES) return false;
  const derivedHash = scryptSync(password, salt, expectedHash.length, scryptOptions());
  return timingSafeEqual(derivedHash, expectedHash);
}

export function verifyStudioPassword(password: string): boolean {
  const saltBase64 = process.env.STUDIO_PASSWORD_SALT;
  const hashBase64 = process.env.STUDIO_PASSWORD_HASH;
  if (!saltBase64 || !hashBase64) return false;
  return verifyConfiguredPassword(password, { saltBase64, hashBase64 });
}
