import type { ComboPlanFamily, StandardPlanCode } from "@/core/commerce/policy";

export type CartPlanCode = StandardPlanCode;

export type CartItemKind = "product" | "account";

export type CartItem = {
  key: string;
  kind: CartItemKind;
  productId: string;
  slug?: string;
  name: string;
  subtitle?: string;
  image?: string | null;
  planId: string;
  planCode: CartPlanCode | "single" | "custom" | "account";
  planName: string;
  durationLabel: string;
  price: number | null;
  priceLabel: string;
  quantity: number;
  category?: string;
  comboEligible?: boolean;
  accountId?: string;
  accountGame?: string;
};

export type ComboGroupSummary = {
  plan: ComboPlanFamily;
  uniqueProducts: number;
  discountPercent: number;
  subtotal: number;
  discount: number;
  nextProducts: number | null;
  nextDiscountPercent: number | null;
};

export type CartTotals = {
  knownSubtotal: number;
  comboDiscount: number;
  knownTotal: number;
  hasUnpricedItems: boolean;
  comboGroups: ComboGroupSummary[];
};
