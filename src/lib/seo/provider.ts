import type { SeoInput } from "./types";
import { MockSeoProvider, type MockMode } from "./mock-provider";

/**
 * Contract for any SEO text generator (mock or real LLM).
 * Returns `unknown` on purpose: model output is untrusted until it passes
 * SeoOutputSchema in the API route.
 */
export interface SeoProvider {
  generate(input: SeoInput): Promise<unknown>;
}

/**
 * Real LLM integration point: implement SeoProvider in a server-only module,
 * read the API key from a server env var (never NEXT_PUBLIC_*), and return it
 * here. This prototype always uses the mock, so no API key is needed.
 */
export function getSeoProvider(mode: MockMode = "normal"): SeoProvider {
  return new MockSeoProvider(mode);
}
