import type {
  CartItem,
  CartPlanCode,
  CartTotals,
  ComboGroupSummary,
  ComboPlanFamily,
  ComboTier,
} from "./types";

export const STANDARD_PLAN_CODES: Array<{
  code: CartPlanCode;
  name: string;
  duration: string;
}> = [
  { code: "1d", name: "Diário", duration: "1 dia" },
  { code: "3d", name: "3 Dias", duration: "3 dias" },
  { code: "7d", name: "7 Dias", duration: "7 dias" },
  { code: "15d", name: "15 Dias", duration: "15 dias" },
  { code: "30d", name: "Mensal", duration: "30 dias" },
  { code: "90d", name: "90 Dias", duration: "90 dias" },
  { code: "lifetime", name: "Lifetime", duration: "Acesso vitalício" },
];

export const COMBO_TIERS: ComboTier[] = [
  { products: 2, discountPercent: 10 },
  { products: 3, discountPercent: 15 },
  { products: 4, discountPercent: 20 },
  { products: 5, discountPercent: 25 },
  { products: 6, discountPercent: 30 },
  { products: 7, discountPercent: 35 },
];

export const COMBO_MAX_DISCOUNT = 35;

export function comboDiscountPercent(uniqueProducts: number) {
  let discount = 0;
  for (const tier of COMBO_TIERS) {
    if (uniqueProducts >= tier.products) discount = tier.discountPercent;
  }
  return discount;
}

export function comboNextTier(uniqueProducts: number) {
  return COMBO_TIERS.find((tier) => tier.products > uniqueProducts) ?? null;
}

function summarizeComboGroup(items: CartItem[], plan: ComboPlanFamily): ComboGroupSummary {
  const eligible = items.filter(
    (item) =>
      item.kind === "product" &&
      item.comboEligible !== false &&
      item.planCode === plan
  );

  const uniqueProducts = new Set(eligible.map((item) => item.productId)).size;
  const discountPercent = comboDiscountPercent(uniqueProducts);
  const pricedSubtotal = eligible.reduce(
    (sum, item) => sum + (item.price ?? 0) * item.quantity,
    0
  );
  const discount = pricedSubtotal * (discountPercent / 100);
  const next = comboNextTier(uniqueProducts);

  return {
    plan,
    uniqueProducts,
    discountPercent,
    subtotal: pricedSubtotal,
    discount,
    nextProducts: next?.products ?? null,
    nextDiscountPercent: next?.discountPercent ?? null,
  };
}

export function calculateCartTotals(items: CartItem[]): CartTotals {
  const knownSubtotal = items.reduce(
    (sum, item) => sum + (item.price ?? 0) * item.quantity,
    0
  );
  const comboGroups = [
    summarizeComboGroup(items, "30d"),
    summarizeComboGroup(items, "lifetime"),
  ];
  const comboDiscount = comboGroups.reduce((sum, group) => sum + group.discount, 0);

  return {
    knownSubtotal,
    comboDiscount,
    knownTotal: Math.max(0, knownSubtotal - comboDiscount),
    hasUnpricedItems: items.some((item) => item.price == null),
    comboGroups,
  };
}

export function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
