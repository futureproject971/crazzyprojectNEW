export type StandardPlanCode = "1d" | "3d" | "7d" | "15d" | "30d" | "90d" | "lifetime";
export type ComboPlanFamily = "30d" | "lifetime";

export const CRAZZY_STANDARD_PLANS = [
  { code: "1d" as const, name: "Diário", duration: "1 dia", note: "Acesso por 24 horas." },
  { code: "3d" as const, name: "3 Dias", duration: "3 dias", note: "Acesso por 3 dias." },
  { code: "7d" as const, name: "7 Dias", duration: "7 dias", note: "Acesso por 7 dias." },
  { code: "15d" as const, name: "15 Dias", duration: "15 dias", note: "Acesso por 15 dias." },
  { code: "30d" as const, name: "Mensal", duration: "30 dias", note: "Elegível ao Combo Mensal.", featured: true },
  { code: "90d" as const, name: "90 Dias", duration: "90 dias", note: "Acesso por 90 dias." },
  { code: "lifetime" as const, name: "Lifetime", duration: "Vitalício", note: "Elegível ao Combo Lifetime." },
] as const;

export const CRAZZY_COMBO_TIERS = [
  { products: 2, discountPercent: 10 },
  { products: 3, discountPercent: 15 },
  { products: 4, discountPercent: 20 },
  { products: 5, discountPercent: 25 },
  { products: 6, discountPercent: 30 },
  { products: 7, discountPercent: 35 },
] as const;

export const CRAZZY_COMBO_MAX_DISCOUNT = 35;

export function getComboDiscountPercent(uniqueProducts: number) {
  let discount = 0;
  for (const tier of CRAZZY_COMBO_TIERS) {
    if (uniqueProducts >= tier.products) discount = tier.discountPercent;
  }
  return discount;
}

export function getNextComboTier(uniqueProducts: number) {
  return CRAZZY_COMBO_TIERS.find((tier) => tier.products > uniqueProducts) ?? null;
}

export function isComboPlan(code: string): code is ComboPlanFamily {
  return code === "30d" || code === "lifetime";
}
