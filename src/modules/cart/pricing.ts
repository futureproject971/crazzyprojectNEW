import {
  CRAZZY_COMBO_MAX_DISCOUNT,
  CRAZZY_COMBO_TIERS,
  CRAZZY_STANDARD_PLANS,
  getComboDiscountPercent,
  getNextComboTier,
  type ComboPlanFamily,
} from "@/core/commerce/policy";
import type { CartItem, CartTotals, ComboGroupSummary } from "./types";

export const STANDARD_PLAN_CODES = CRAZZY_STANDARD_PLANS;
export const COMBO_TIERS = CRAZZY_COMBO_TIERS;
export const COMBO_MAX_DISCOUNT = CRAZZY_COMBO_MAX_DISCOUNT;

export const comboDiscountPercent = getComboDiscountPercent;
export const comboNextTier = getNextComboTier;

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
