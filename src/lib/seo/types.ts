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