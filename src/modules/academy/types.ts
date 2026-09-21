export type AcademyBlockType =
  | "title"
  | "subtitle"
  | "text"
  | "image"
  | "video"
  | "gallery"
  | "checklist"
  | "shortcut"
  | "code"
  | "file"
  | "button"
  | "info"
  | "attention"
  | "important"
  | "success"
  | "separator"
  | "step";

export type AcademyProductRef = {
  id: string;
  name: string;
  image_url: string | null;
};

export type AcademyProgress = {
  last_position: number;
  completed: boolean;
};

export type AcademyTutorialCard = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  category: string;
  access_type: "public" | "product";
  cover_url: string | null;
  estimated_minutes: number;
  featured: boolean;
  sort_order: number;
  unlocked: boolean;
  locked: boolean;
  products: AcademyProductRef[];
  progress: AcademyProgress;
};

export type AcademyBlock = {
  id: string;
  type: AcademyBlockType;
  position: number;
  content: Record<string, unknown>;
};

export type AcademyTutorial = AcademyTutorialCard & {
  blocks: AcademyBlock[];
};
