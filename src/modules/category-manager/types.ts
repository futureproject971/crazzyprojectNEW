export type CategoryManagerItem = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image_url: string | null;
  icon_url: string | null;
  emoji: string | null;
  accent_color: string | null;
  active: boolean;
  sort_order: number;
  product_count: number;
  active_product_count: number;
};

export type CategoryManagerCatalog = {
  categories: CategoryManagerItem[];
};

export type PublicCategory = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image_url: string | null;
  icon_url: string | null;
  emoji: string | null;
  accent_color: string | null;
  sort_order: number;
  product_count: number;
};
