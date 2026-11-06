import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import {
  checkPassword,
  createAdminSession,
  deleteAdminSession,
  isDemoAdmin,
  getSeoProvider,
  GenerateInputSchema,
  SeoOutputSchema,
  ReviewInputSchema,
  saveDraft,
  reviewDraft,
  type ActionResult,
} from "@/lib/seo";
import { LoginForm, SeoHelper } from "./seo-helper";

export const metadata: Metadata = {
  title: "AI SEO Helper (Admin)",
  robots: { index: false, follow: false },
};

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export default function AdminSeoPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">AI SEO Helper</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Admin-only prototype · mock AI provider · fictional content only · human approval required
        </p>
      </header>
      {/* With cacheComponents, reading the session cookie must happen inside Suspense */}
      <Suspense fallback={<p className="mt-10 text-center text-sm text-zinc-500">Checking session...</p>}>
        <AdminGate />
      </Suspense>
    </main>
  );
}

// The server decides who is an admin. The browser never holds an "isAdmin" flag.
async function AdminGate() {
  if (!(await isDemoAdmin())) {
    return <LoginForm loginAction={login} />;
  }
  return (
    <SeoHelper
      generateAction={generate}
      reviewAction={review}
      logoutAction={logout}
      allowSimulation={!IS_PRODUCTION}
    />
  );
}

// ---------------------------------------------------------------------------
// Server actions: they run only on the server.
// - Next.js accepts them only as POST requests whose Origin matches the Host
//   (built-in CSRF protection).
// - Anyone could call an action directly, so each one re-checks the session.
// ---------------------------------------------------------------------------

async function login(password: unknown): Promise<ActionResult> {
  "use server";
  if (!checkPassword(password)) {
    return { error: "Invalid credentials" };
  }
  if (!(await createAdminSession())) {
    return { error: "Demo auth is not configured: set SESSION_SECRET (32+ characters)" };
  }
  return {}; // setting the cookie re-renders this page, which now shows the helper
}

async function logout(): Promise<ActionResult> {
  "use server";
  await deleteAdminSession(); // re-renders this page, which now shows the login form
  return {};
}

async function generate(request: unknown): Promise<ActionResult> {
  "use server";
  // 1. Server-side authorization
  if (!(await isDemoAdmin())) {
    return { error: "Admin login required" };
  }

  // 2. Validate input (lengths, no personal data)
  const parsed = GenerateInputSchema.safeParse(request);
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error) };
  }
  const { simulate, ...input } = parsed.data;
  if (simulate && IS_PRODUCTION) {
    return { error: "Failure simulation is disabled in production" };
  }

  // 3. Call the AI provider (mock by default)
  let rawOutput: unknown;
  try {
    rawOutput = await getSeoProvider(simulate ?? "normal").generate(input);
  } catch (error) {
    console.error("[seo] provider failed:", error); // details stay in the server log
    return { error: "SEO suggestion generation failed. Please try again." };
  }

  // 4. Validate the untrusted AI output (shape, lengths, unsupported claims)
  const output = SeoOutputSchema.safeParse(rawOutput);
  if (!output.success) {
    console.warn("[seo] AI output rejected:", output.error.issues);
    return { error: "AI output failed validation (format, length or unsupported claims). Nothing was saved." };
  }

  // 5. Save as a draft waiting for human review. Never published automatically.
  return { draft: saveDraft(input, output.data) };
}

async function review(request: unknown): Promise<ActionResult> {
  "use server";
  if (!(await isDemoAdmin())) {
    return { error: "Admin login required" };
  }

  const parsed = ReviewInputSchema.safeParse(request);
  if (!parsed.success) {
    return { error: "Decision must be 'approve' or 'reject'" };
  }

  // Records the human decision only. This does NOT publish anything.
  return reviewDraft(parsed.data.id, parsed.data.decision);
}
