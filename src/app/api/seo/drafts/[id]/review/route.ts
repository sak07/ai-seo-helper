import { NextRequest, NextResponse } from "next/server";
import { ReviewSchema } from "@/lib/seo/schema";
import { isDemoAdmin, isSameOrigin } from "@/lib/seo/auth";
import { getDraft, reviewDraft } from "@/lib/seo/drafts";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/seo/drafts/[id]/review">
) {
  // 1. CSRF check
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  // 2. Server-side authorization
  if (!(await isDemoAdmin())) {
    return NextResponse.json({ error: "Admin login required" }, { status: 401 });
  }

  // 3. Validate the decision (invalid JSON becomes null and fails validation)
  const body = await request.json().catch(() => null);
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Decision must be 'approve' or 'reject'" }, { status: 400 });
  }

  // 4. Only a pending draft can be reviewed
  const { id } = await ctx.params;
  const draft = getDraft(id);
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  if (draft.status !== "pending_approval") {
    return NextResponse.json({ error: "Draft has already been reviewed" }, { status: 409 });
  }

  // 5. Record the human decision. This does NOT publish anything.
  const updated = reviewDraft(draft, parsed.data.decision);
  return NextResponse.json({ draft: updated });
}
