import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";

/*
 * Server-side core of the AI SEO helper:
 *   1. Types
 *   2. AI provider (interface + mock)
 *   3. Validation and safety rules
 *   4. Demo admin session
 *   5. In-memory draft store
 */

// ===========================================================================
// 1. Types
// ===========================================================================

export interface SeoInput {
  title: string;
  description: string;
}

export interface SeoOutput {
  seoTitle: string;
  metaDescription: string;
  faqs: { question: string; answer: string }[];
}

export interface SeoDraft {
  id: string;
  input: SeoInput;
  suggestion: SeoOutput;
  status: "pending_approval" | "approved" | "rejected";
  createdAt: string;
  reviewedAt?: string;
  published: false; // this prototype has no publishing path
}

/** What every server action returns to the browser. */
export interface ActionResult {
  draft?: SeoDraft;
  error?: string;
}

// ===========================================================================
// 2. AI provider
// ===========================================================================

/** Contract for any AI provider. Returns `unknown`: AI output is untrusted until validated. */
export interface SeoProvider {
  generate(input: SeoInput): Promise<unknown>;
}

/** "invalid_output" and "provider_error" exist only to demo failure handling (dev only). */
export type MockMode = "normal" | "invalid_output" | "provider_error";

/** Fake AI: no network calls, no API key, never invents facts. */
class MockSeoProvider implements SeoProvider {
  private readonly mode: MockMode;

  constructor(mode: MockMode) {
    this.mode = mode;
  }

  async generate(input: SeoInput): Promise<unknown> {
    if (this.mode === "provider_error") {
      throw new Error("Simulated provider outage (internal detail, must not reach the client)");
    }
    if (this.mode === "invalid_output") {
      return { seoTitle: "Tickets from AED 99", faqs: [] }; // wrong shape + invented price
    }

    const output: SeoOutput = {
      seoTitle: buildSeoTitle(input.title),
      metaDescription: buildMetaDescription(input.description),
      faqs: [
        {
          question: `What is ${input.title.slice(0, 130)}?`,
          answer: "This is a fictional example event created to demonstrate an AI-assisted SEO content workflow.",
        },
        {
          question: "Where can I verify the event details?",
          answer: "Please consult the official event listing or contact the venue to confirm dates, availability, and other details.",
        },
      ],
    };
    return output;
  }
}

/**
 * REAL LLM INTEGRATION POINT: write a class that implements SeoProvider and
 * calls the LLM API with a key from a server-only env var (never NEXT_PUBLIC_*),
 * then return it here. Nothing else needs to change.
 */
export function getSeoProvider(mode: MockMode = "normal"): SeoProvider {
  return new MockSeoProvider(mode);
}

const BRAND_SUFFIX = " | Space42 Arena";

/** SEO title: page title + brand, max 60 characters. */
function buildSeoTitle(title: string): string {
  const maxTitleLength = 60 - BRAND_SUFFIX.length;
  return title.slice(0, maxTitleLength).trimEnd() + BRAND_SUFFIX;
}

/** Meta description: 50-160 characters, cut on a whole word if too long. */
function buildMetaDescription(description: string): string {
  if (description.length < 50) {
    const padded = `${description} Explore this fictional event and review official information before making plans.`;
    return padded.slice(0, 160);
  }
  if (description.length <= 160) {
    return description;
  }
  const cut = description.slice(0, 157);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "...";
}

// ===========================================================================
// 3. Validation and safety rules
// ===========================================================================

// Customer data must never be sent to an AI provider.
const PERSONAL_DATA_PATTERNS = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // email address
  /(\d[\s-]?){9,}/, // phone, card or ID number (9+ digits)
];

// Facts the AI must never invent. A human adds verified facts later.
const UNSUPPORTED_CLAIM_PATTERNS = [
  /(AED|USD|\$|€|£)\s?\d|\d\s?(AED|dirhams?)\b/i, // price, e.g. "AED 99"
  /\b20\d{2}\b/, // year, e.g. "2027"
  /\b\d{1,2}(st|nd|rd|th)?\s(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, // date, e.g. "14 March"
  /guarantee/i, // guarantees
  /sold out|limited (seats|tickets)/i, // availability claims
];

function hasPersonalData(text: string): boolean {
  return PERSONAL_DATA_PATTERNS.some((pattern) => pattern.test(text));
}

function hasUnsupportedClaim(text: string): boolean {
  return UNSUPPORTED_CLAIM_PATTERNS.some((pattern) => pattern.test(text));
}

const NO_PERSONAL_DATA = "Remove personal data (emails, phone numbers). Use fictional content only.";

/** Admin input. `simulate` forces a provider failure for the demo (dev only). */
export const GenerateInputSchema = z.object({
  title: z.string().trim().min(3).max(120)
    .refine((text) => !hasPersonalData(text), NO_PERSONAL_DATA),
  description: z.string().trim().min(10).max(1000)
    .refine((text) => !hasPersonalData(text), NO_PERSONAL_DATA),
  simulate: z.enum(["invalid_output", "provider_error"]).optional(),
}).strict();

/** AI output is untrusted: check shape, lengths, invented claims and personal data. */
export const SeoOutputSchema = z.object({
  seoTitle: z.string().trim().min(10).max(60),
  metaDescription: z.string().trim().min(50).max(160),
  faqs: z.array(
    z.object({
      question: z.string().trim().min(5).max(150),
      answer: z.string().trim().min(10).max(500),
    }).strict()
  ).min(2).max(3),
}).strict()
  // JSON.stringify checks every text field at once
  .refine((output) => !hasUnsupportedClaim(JSON.stringify(output)), "Unsupported claim (price, date, guarantee or availability)")
  .refine((output) => !hasPersonalData(JSON.stringify(output)), "Output contains personal data");

export const ReviewInputSchema = z.object({
  id: z.string(),
  decision: z.enum(["approve", "reject"]),
}).strict();

// ===========================================================================
// 4. Demo admin session. DEMO ONLY, not production authentication.
//    DEMO_ADMIN_SECRET = demo admin password, SESSION_SECRET = cookie signing key.
//    Both are server-only env vars. The cookie looks like
//    "admin.<expiryUnixSeconds>.<signature>" and contains no secret.
// ===========================================================================

const SESSION_COOKIE = "seo_admin_session";
const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes

/** HMAC signature, or null when SESSION_SECRET is missing (fail closed). */
function sign(payload: string): string | null {
  const key = process.env.SESSION_SECRET;
  if (!key || key.length < 32) return null;
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** Constant-time comparison (hashing first makes both inputs the same length). */
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function checkPassword(password: unknown): boolean {
  const expected = process.env.DEMO_ADMIN_SECRET;
  if (!expected || typeof password !== "string") return false;
  return safeEqual(password, expected);
}

/** Sets the signed session cookie. Returns false if SESSION_SECRET is not configured. */
export async function createAdminSession(): Promise<boolean> {
  const payload = `admin.${Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS}`;
  const signature = sign(payload);
  if (!signature) return false;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, `${payload}.${signature}`, {
    httpOnly: true, // browser JavaScript cannot read it
    sameSite: "strict", // not sent with cross-site requests (CSRF)
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return true;
}

export async function deleteAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** Server-side admin check, used by the page and by every server action. */
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

// ===========================================================================
// 5. In-memory draft store. DEMO ONLY: lost on restart (and on hot reload in
//    dev), not shared between server instances. Production would use a database.
// ===========================================================================

const drafts = new Map<string, SeoDraft>();

export function saveDraft(input: SeoInput, suggestion: SeoOutput): SeoDraft {
  const draft: SeoDraft = {
    id: randomUUID(),
    input,
    suggestion,
    status: "pending_approval",
    createdAt: new Date().toISOString(),
    published: false,
  };
  drafts.set(draft.id, draft);
  return draft;
}

/** Records the human decision. Only pending drafts can be reviewed. Nothing is published. */
export function reviewDraft(id: string, decision: "approve" | "reject"): ActionResult {
  const draft = drafts.get(id);
  if (!draft) {
    return { error: "Draft not found" };
  }
  if (draft.status !== "pending_approval") {
    return { error: "Draft has already been reviewed" };
  }

  draft.status = decision === "approve" ? "approved" : "rejected";
  draft.reviewedAt = new Date().toISOString();
  return { draft };
}
