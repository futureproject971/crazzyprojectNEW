import { discountForCount, type ComboTier } from "../../../supabase/functions/_shared/combo-policy";
export { comboTiersFromDiscounts, validComboDiscounts, type ComboTier } from "../../../supabase/functions/_shared/combo-policy";
export type StandardPlanCode = "trial" | "1d" | "3d" | "7d" | "15d" | "30d" | "90d" | "lifetime";
export type ComboPlanFamily = "30d" | "lifetime";

export const CRAZZY_STANDARD_PLANS = [
  { code: "trial" as const, name: "Trial", duration: "1 hora", note: "Teste por 1 hora." },
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

export function getComboDiscountPercent(uniqueProducts: number, tiers: readonly ComboTier[] = CRAZZY_COMBO_TIERS) {
  return discountForCount(uniqueProducts, tiers);
}

export function getNextComboTier(uniqueProducts: number, tiers: readonly ComboTier[] = CRAZZY_COMBO_TIERS) {
  const current = getComboDiscountPercent(uniqueProducts, tiers);
  return tiers.find(tier => tier.products > uniqueProducts && tier.discountPercent > current) ?? null;
}

export function isComboPlan(code: string): code is ComboPlanFamily {
  return code === "30d" || code === "lifetime";
}


export function shouldShowPlanToCustomer(
  stockCount: number | null | undefined,
  showWhenOutOfStock = false
) {
  if (stockCount == null) return true;
  return stockCount > 0 || showWhenOutOfStock;
}

export function isPlanPurchasable(stockCount: number | null | undefined) {
  return stockCount == null || stockCount > 0;
}
