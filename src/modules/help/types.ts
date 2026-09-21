export type HelpFaq = {
  id: string;
  category: string;
  question: string;
  answer: string;
  featured: boolean;
  sort_order: number;
  score: number;
};

export type HelpTutorial = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  category: string;
  estimated_minutes: number;
  featured: boolean;
  cover_url: string | null;
  score: number;
};

export type HelpSearchResult = {
  query: string;
  faqs: HelpFaq[];
  tutorials: HelpTutorial[];
};
