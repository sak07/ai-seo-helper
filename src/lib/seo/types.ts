export interface SeoInput {
  title: string;
  description: string;
}

export interface SeoFaq {
  question: string;
  answer: string;
}

export interface SeoOutput {
  seoTitle: string;
  metaDescription: string;
  faqs: SeoFaq[];
}

export type DraftStatus = "pending_approval" | "approved" | "rejected";

export interface SeoDraft {
  id: string;
  input: SeoInput;
  suggestion: SeoOutput;
  status: DraftStatus;
  createdAt: string;
  reviewedAt?: string;
  published: false; // this prototype has no publishing path
}