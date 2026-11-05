import { NextRequest, NextResponse } from "next/server";
import { LoginSchema } from "@/lib/seo/schema";
import {
  checkPassword,
  createSessionToken,
  isSameOrigin,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/seo/auth";

export async function POST(request: NextRequest) {
  // 1. CSRF check
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  // 2. Check the password (invalid JSON becomes null and fails validation)
  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success || !checkPassword(parsed.data.password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // 3. Create a signed, expiring session token
  const token = createSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Demo authentication is not configured" }, { status: 500 });
  }

  // 4. Store it in an HTTP-only cookie. The cookie never contains the password or a secret.
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, // JavaScript in the browser cannot read it
    sameSite: "strict", // not sent on cross-site requests (CSRF)
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
