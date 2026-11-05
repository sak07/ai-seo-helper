import type { SeoInput, SeoOutput } from "./types";

export class MockSeoProvider {
  async generate(input: SeoInput): Promise<unknown> {
    const title = input.title.trim();
    const description = input.description.trim();

    // Generate an SEO title within 60 characters
    const suffix = " | Space42 Arena";
    const seoTitle =
      title.length + suffix.length <= 60
        ? title + suffix
        : title.slice(0, 60 - suffix.length).trimEnd() + suffix;

    // Generate a meta description within 160 characters
    const metaDescription =
      description.length >= 50
        ? description.slice(0, 160).trimEnd()
        : `${description} Explore this fictional event and review official information before making plans.`.slice(
            0,
            160
          );

    // Generate FAQs without inventing event details
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
      seoTitle,
      metaDescription,
      faqs,
    };

    return result;
  }
}