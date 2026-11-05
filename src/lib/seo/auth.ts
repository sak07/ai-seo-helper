import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

/*
 * DEMO AUTH ONLY. This is not production authentication.
 *
 * - DEMO_ADMIN_SECRET: the shared demo admin password (server-side env var)
 * - SESSION_SECRET:    key used to sign session cookies (server-side env var)
 *
 * After login the browser gets an HTTP-only cookie like:
 *   "admin.<expiryUnixSeconds>.<signature>"
 * It contains no secret. Changing any part breaks the signature.
 */
export const SESSION_COOKIE = "seo_admin_session";
export const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes

/** Returns an HMAC signature, or null if SESSION_SECRET is missing (fail closed). */
function sign(payload: string): string | null {
  const key = process.env.SESSION_SECRET;
  if (!key || key.length < 32) return null;
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** Constant-time string comparison (hashing first makes both inputs the same length). */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function checkPassword(password: string): boolean {
  const expected = process.env.DEMO_ADMIN_SECRET;
  if (!expected) return false;
  return safeEqual(password, expected);
}

export function createSessionToken(): string | null {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `admin.${expiry}`;

  const signature = sign(payload);
  if (!signature) return null;

  return `${payload}.${signature}`;
}

/** Server-side admin check used by the admin page and every protected API route. */
export async function isDemoAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return false;

  const [role, expiry, signature] = token.split(".");
  if (role !== "admin" || !expiry || !signature) return false;

  const expectedSignature = sign(`${role}.${expiry}`);
  if (!expectedSignature || !safeEqual(signature, expectedSignature)) return false;

  const nowSeconds = Date.now() / 1000;
  return Number(expiry) > nowSeconds;
}

/**
 * CSRF protection (together with the SameSite=Strict cookie):
 * a POST is only accepted if the browser says it came from this same site.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false; // malformed Origin header
  }
}
