export type PublicStorePlan = {
  id: string;
  name: string;
  price: number;
  plan_code: string | null;
  sort_order: number;
  show_when_out_of_stock: boolean;
  emoji: string | null;
  accent_color: string | null;
  delivery_mode: string;
  stock_managed: boolean;
  stock_count: number | null;
};

export type PublicStoreGame = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  icon_url: string | null;
  emoji: string | null;
  accent_color: string | null;
};

export type PublicStoreMedia = {
  id: string;
  media_type: string;
  url: string;
  sort_order: number;
};

export type PublicStoreFeature = {
  id: string;
  label: string;
  value: string;
  sort_order: number;
};

export type PublicStoreProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  features_text: string | null;
  image_url: string | null;
  is_new: boolean;
  status: string | null;
  status_label: string | null;
  emoji: string | null;
  accent_color: string | null;
  sort_order: number;
  created_at: string;
  game: PublicStoreGame;
  plans: PublicStorePlan[];
  media: PublicStoreMedia[];
  features: PublicStoreFeature[];
};

export function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

export function getProductStock(product: PublicStoreProduct) {
  const plans = Array.isArray(product.plans) ? product.plans : [];
  if (!plans.length) return { state: "out" as const, label: "Sem planos disponíveis", count: 0 };

  const unlimited = plans.some((plan) => !plan.stock_managed);
  if (unlimited) return { state: "available" as const, label: "Disponível", count: null };

  const count = plans.reduce((sum, plan) => sum + Math.max(0, Number(plan.stock_count || 0)), 0);
  if (count <= 0) return { state: "out" as const, label: "Esgotado", count: 0 };
  if (count <= 5) return { state: "limited" as const, label: count === 1 ? "Última unidade" : `${count} unidades`, count };
  return { state: "available" as const, label: "Disponível", count };
}

export function getProductStartingPrice(product: PublicStoreProduct) {
  const prices = (product.plans || [])
    .map((plan) => Number(plan.price))
    .filter((price) => Number.isFinite(price) && price >= 0);
  return prices.length ? Math.min(...prices) : null;
}

export function normalizePublicCatalog(value: unknown): PublicStoreProduct[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      id: String(item.id || ""),
      slug: String(item.slug || ""),
      name: String(item.name || ""),
      description: typeof item.description === "string" ? item.description : null,
      features_text: typeof item.features_text === "string" ? item.features_text : null,
      image_url: typeof item.image_url === "string" ? item.image_url : null,
      is_new: item.is_new === true,
      status: typeof item.status === "string" ? item.status : null,
      status_label: typeof item.status_label === "string" ? item.status_label : null,
      emoji: typeof item.emoji === "string" ? item.emoji : null,
      accent_color: typeof item.accent_color === "string" ? item.accent_color : null,
      sort_order: Number(item.sort_order || 0),
      created_at: String(item.created_at || ""),
      game: (item.game && typeof item.game === "object" ? item.game : {}) as PublicStoreGame,
      plans: Array.isArray(item.plans) ? item.plans as PublicStorePlan[] : [],
      media: Array.isArray(item.media) ? item.media as PublicStoreMedia[] : [],
      features: Array.isArray(item.features) ? item.features as PublicStoreFeature[] : [],
    }))
    .filter((item) => item.id && item.slug && item.name && item.game?.slug);
}
