export type ComboTier = { products: number; discountPercent: number };

export function validComboDiscounts(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 6 && value.every((percent, index) =>
    typeof percent === "number" && Number.isInteger(percent) && percent >= 0 && percent <= 99 &&
    (index === 0 || percent >= value[index - 1])
  );
}
export function comboTiersFromDiscounts(value: unknown): ComboTier[] | null {
  return validComboDiscounts(value) ? value.map((discountPercent, index) => ({ products: index + 2, discountPercent })) : null;
}
export function discountForCount(count: number, tiers: readonly ComboTier[]) {
  return tiers.reduce((discount, tier) => count >= tier.products ? tier.discountPercent : discount, 0);
}
