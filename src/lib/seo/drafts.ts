import "server-only";
import { randomUUID } from "node:crypto";
import type { SeoDraft, SeoInput, SeoOutput } from "./types";

/*
 * In-memory draft store. DEMO ONLY:
 * - all drafts are lost when the server restarts
 * - not shared between multiple server instances
 * Production would use a database.
 *
 * The Map lives on globalThis so it survives hot reloads in `next dev`.
 */
const globalForDrafts = globalThis as unknown as { seoDrafts?: Map<string, SeoDraft> };

if (!globalForDrafts.seoDrafts) {
  globalForDrafts.seoDrafts = new Map();
}

const drafts = globalForDrafts.seoDrafts;

export function createDraft(input: SeoInput, suggestion: SeoOutput): SeoDraft {
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

export function getDraft(id: string): SeoDraft | undefined {
  return drafts.get(id);
}

/** Records the human decision only. Nothing is ever published. */
export function reviewDraft(draft: SeoDraft, decision: "approve" | "reject"): SeoDraft {
  draft.status = decision === "approve" ? "approved" : "rejected";
  draft.reviewedAt = new Date().toISOString();
  return draft;
}
