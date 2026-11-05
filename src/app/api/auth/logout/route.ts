import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin, SESSION_COOKIE } from "@/lib/seo/auth";

export async function POST(request: NextRequest) {
  // 1. CSRF check
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  // 2. Delete the session cookie
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
