import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSeoProvider } from "@/lib/seo/provider";
import { GenerateRequestSchema, SeoOutputSchema } from "@/lib/seo/schema";
import { isDemoAdmin, isSameOrigin } from "@/lib/seo/auth";
import { createDraft } from "@/lib/seo/drafts";

export async function POST(request: NextRequest) {
  // 1. CSRF check
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  // 2. Server-side authorization
  if (!(await isDemoAdmin())) {
    return NextResponse.json({ error: "Admin login required" }, { status: 401 });
  }

  // 3. Validate input (invalid JSON becomes null and fails validation)
  const body = await request.json().catch(() => null);
  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", fields: z.flattenError(parsed.error).fieldErrors },
      { status: 400 }
    );
  }

  const { simulate, ...input } = parsed.data;
  if (simulate && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Failure simulation is disabled in production" }, { status: 400 });
  }

  // 4. Call the provider (mock by default)
  const provider = getSeoProvider(simulate ?? "normal");
  let rawOutput: unknown;
  try {
    rawOutput = await provider.generate(input);
  } catch (error) {
    // Log details on the server only; the client gets a generic message
    console.error("[seo] provider failed:", error);
    return NextResponse.json(
      { error: "SEO suggestion generation failed. Please try again." },
      { status: 502 }
    );
  }

  // 5. Validate the untrusted AI output (shape, lengths, unsupported claims)
  const output = SeoOutputSchema.safeParse(rawOutput);
  if (!output.success) {
    console.warn("[seo] AI output rejected:", output.error.issues);
    return NextResponse.json(
      { error: "AI output failed validation (format, length or unsupported claims). Nothing was saved." },
      { status: 502 }
    );
  }

  // 6. Save as a draft that waits for human review. Never published automatically.
  const draft = createDraft(input, output.data);
  return NextResponse.json({ draft }, { status: 201 });
}
