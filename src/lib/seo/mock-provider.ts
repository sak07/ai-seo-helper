import type { SeoInput, SeoOutput } from "./types";
import type { SeoProvider } from "./provider";

/**
 * "normal" returns safe suggestions.
 * "invalid_output" and "provider_error" exist only to demo failure handling (dev only).
 */
export type MockMode = "normal" | "invalid_output" | "provider_error";

const BRAND_SUFFIX = " | Space42 Arena";

/** Fake AI provider: no network calls, no API key, deterministic output. */
export class MockSeoProvider implements SeoProvider {
  private readonly mode: MockMode;

  constructor(mode: MockMode = "normal") {
    this.mode = mode;
  }

  async generate(input: SeoInput): Promise<unknown> {
    if (this.mode === "provider_error") {
      throw new Error("Simulated provider outage (internal detail, must not reach the client)");
    }

    if (this.mode === "invalid_output") {
      // Wrong shape and an invented price, like a misbehaving LLM might return
      return { seoTitle: "Tickets from AED 99", faqs: [] };
    }

    const title = input.title.trim();
    const description = input.description.trim();

    // FAQs only restate the input. No dates, prices, performers or guarantees are invented.
    const faqs = [
      {
        question: `What is ${title.slice(0, 130)}?`,
        answer:
          "This is a fictional example event created to demonstrate an AI-assisted SEO content workflow.",
      },
      {
        question: "Where can I verify the event details?",
        answer:
          "Please consult the official event listing or contact the venue to confirm dates, availability, and other details.",
      },
    ];

    const result: SeoOutput = {
      seoTitle: buildSeoTitle(title),
      metaDescription: buildMetaDescription(description),
      faqs,
    };
    return result;
  }
}

/** SEO title: page title + brand, max 60 characters. */
function buildSeoTitle(title: string): string {
  const maxTitleLength = 60 - BRAND_SUFFIX.length;

  if (title.length <= maxTitleLength) {
    return title + BRAND_SUFFIX;
  }
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
  const wholeWords = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return wholeWords + "...";
}
