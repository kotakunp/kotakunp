import { cookies } from "next/headers";
import process from "node:process";
import type { StudioSession } from "./session";
import { verifySessionToken } from "./session";

export const SESSION_COOKIE_NAME_PRODUCTION = "__Host-kotakunp-studio";
export const SESSION_COOKIE_NAME_DEVELOPMENT = "kotakunp-studio-dev";

const COOKIE_FLAG_BASE = "HttpOnly; SameSite=Strict; Path=/";

export function isStudioInProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getSessionCookieName(): string {
  return isStudioInProduction() ? SESSION_COOKIE_NAME_PRODUCTION : SESSION_COOKIE_NAME_DEVELOPMENT;
}

export function buildSessionCookie(token: string, maxAgeSeconds: number): string {
  const secureAttribute = isStudioInProduction() ? "; Secure" : "";
  return `${getSessionCookieName()}=${token}; ${COOKIE_FLAG_BASE}${secureAttribute}; Max-Age=${maxAgeSeconds}`;
}

export function buildSessionClearCookie(): string {
  return buildSessionCookie("", 0);
}

export function getTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;
    if (part.slice(0, separatorIndex).trim() !== getSessionCookieName()) continue;
    const value = part.slice(separatorIndex + 1).trim();
    return value.length > 0 ? value : null;
  }
  return null;
}

export async function requireStudioSessionFromRequest(
  request: Request,
): Promise<StudioSession | null> {
  return await verifySessionToken(getTokenFromRequest(request));
}

export async function requireStudioSession(): Promise<StudioSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value ?? null;
  return await verifySessionToken(token);
}

export function getExpectedOrigin(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return null;
  try {
    return new URL(siteUrl).origin;
  } catch {
    return null;
  }
}

export function assertSameOrigin(request: Request): boolean {
  const expectedOrigin = getExpectedOrigin();
  if (!expectedOrigin) return false;
  return request.headers.get("origin") === expectedOrigin;
}
