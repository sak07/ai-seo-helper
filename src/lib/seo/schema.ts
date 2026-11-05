import { z } from "zod";

// ---------------------------------------------------------------------------
// Safety rules (simple regex checks, easy to extend)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Input: what the admin types
// ---------------------------------------------------------------------------

export const SeoInputSchema = z.object({
  title: z.string().trim().min(3).max(120)
    .refine((text) => !hasPersonalData(text), NO_PERSONAL_DATA),
  description: z.string().trim().min(10).max(1000)
    .refine((text) => !hasPersonalData(text), NO_PERSONAL_DATA),
}).strict();

// The generate request may also ask the mock to fail on purpose (dev only).
export const GenerateRequestSchema = SeoInputSchema.extend({
  simulate: z.enum(["invalid_output", "provider_error"]).optional(),
});

// ---------------------------------------------------------------------------
// Output: what the AI provider returns (always treated as untrusted)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Other request bodies
// ---------------------------------------------------------------------------

export const LoginSchema = z.object({
  password: z.string().min(1).max(200),
}).strict();

export const ReviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
}).strict();
