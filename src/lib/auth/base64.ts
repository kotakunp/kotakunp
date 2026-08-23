const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export function decodeBase64ToBytes(value: unknown): Uint8Array | null {
  if (typeof value !== "string" || value.length === 0 || value.length % 4 !== 0) return null;
  if (!BASE64_PATTERN.test(value)) return null;
  const bytes = Buffer.from(value, "base64");
  return bytes.length > 0 ? new Uint8Array(bytes) : null;
}

export function encodeBytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
