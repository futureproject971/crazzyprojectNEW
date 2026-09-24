export type ManagerTutorial = {
  id: string;
  title: string;
  slug: string;
  active?: boolean;
  access_type?: "public" | "product";
};

export type ManagerDeliveryMode =
  | "internal_stock"
  | "ghost_stock"
  | "purincash_supplier"
  | "lzt_account"
  | "manual"
  | "service";

export type ManagerPlanCode =
  | "1d"
  | "3d"
  | "7d"
  | "15d"
  | "30d"
  | "90d"
  | "lifetime"
  | "single"
  | "custom";

export type ManagerPlan = {
  id: string;
  name: string;
  price: number;
  active: boolean;
  sort_order: number;
  plan_code: ManagerPlanCode | null;
  show_when_out_of_stock: boolean;
  emoji: string | null;
  accent_color: string | null;
  delivery_mode: ManagerDeliveryMode;
  discord_role_id: string | null;
  discord_role_name: string | null;
  discord_role_color: string | null;
  discord_role_position: number | null;
  entitlement_duration_minutes: number | null;
  supplier_provider: string | null;
  supplier_product_id: string | null;
  supplier_variation_id: string | null;
  automation_flags: Record<string, unknown>;
  available_stock: number;
  tutorials: ManagerTutorial[];
};

export type ManagerProduct = {
  id: string;
  name: string;
  game_id: string;
  game_name: string;
  description: string | null;
  features_text: string | null;
  image_url: string | null;
  is_new: boolean;
  active: boolean;
  sort_order: number;
  status: string;
  status_label: string;
  emoji: string | null;
  accent_color: string | null;
  automation_flags: Record<string, unknown>;
  tutorials: ManagerTutorial[];
  plans: ManagerPlan[];
};

export type ManagerGame = {
  id: string;
  name: string;
  slug: string | null;
  active: boolean;
};

export type ManagerCatalog = {
  products: ManagerProduct[];
  games: ManagerGame[];
  tutorials: ManagerTutorial[];
};
