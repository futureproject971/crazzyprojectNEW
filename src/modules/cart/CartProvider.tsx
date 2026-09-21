"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { calculateCartTotals } from "./pricing";
import type { CartItem } from "./types";
import { CartDrawer } from "./CartDrawer";

const STORAGE_KEY = "crazzy.cart.v1";
const MAX_QUANTITY = 20;

type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  drawerOpen: boolean;
  totalQuantity: number;
  totals: ReturnType<typeof calculateCartTotals>;
  couponCode: string;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  changePlan: (
    key: string,
    plan: Pick<CartItem, "planId" | "planCode" | "planName" | "durationLabel" | "price" | "priceLabel">
  ) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  setCouponCode: (code: string) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function safeStoredItems(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item && typeof item === "object" && typeof item.key === "string")
      .slice(0, 50)
      .map((item) => ({
        ...item,
        quantity: Math.max(1, Math.min(MAX_QUANTITY, Number(item.quantity) || 1)),
      })) as CartItem[];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [couponCode, setCouponCodeState] = useState("");

  useEffect(() => {
    setItems(safeStoredItems(window.localStorage.getItem(STORAGE_KEY)));
    setCouponCodeState(window.localStorage.getItem(STORAGE_KEY + ".coupon") || "");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY + ".coupon", couponCode);
  }, [couponCode, hydrated]);

  const addItem = useCallback((incoming: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    const quantity = Math.max(1, Math.min(MAX_QUANTITY, incoming.quantity ?? 1));
    setItems((current) => {
      const existing = current.find((item) => item.key === incoming.key);
      if (!existing) return [...current, { ...incoming, quantity }];
      return current.map((item) =>
        item.key === incoming.key
          ? {
              ...item,
              ...incoming,
              quantity: item.kind === "account"
                ? 1
                : Math.min(MAX_QUANTITY, item.quantity + quantity),
            }
          : item
      );
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        if (item.kind === "account") return { ...item, quantity: 1 };
        return {
          ...item,
          quantity: Math.max(1, Math.min(MAX_QUANTITY, Math.round(quantity) || 1)),
        };
      })
    );
  }, []);

  const changePlan = useCallback((
    key: string,
    plan: Pick<CartItem, "planId" | "planCode" | "planName" | "durationLabel" | "price" | "priceLabel">
  ) => {
    setItems((current) => {
      const source = current.find((item) => item.key === key);
      if (!source || source.kind !== "product") return current;

      const nextKey = source.kind + ":" + source.productId + ":" + plan.planId;
      const nextItem = { ...source, ...plan, key: nextKey };
      const duplicate = current.find((item) => item.key === nextKey && item.key !== key);

      if (duplicate) {
        return current
          .filter((item) => item.key !== key)
          .map((item) =>
            item.key === nextKey
              ? { ...item, quantity: Math.min(MAX_QUANTITY, item.quantity + source.quantity) }
              : item
          );
      }

      return current.map((item) => item.key === key ? nextItem : item);
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCouponCodeState("");
  }, []);

  const totals = useMemo(() => calculateCartTotals(items), [items]);
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      hydrated,
      drawerOpen,
      totalQuantity,
      totals,
      couponCode,
      addItem,
      removeItem,
      setQuantity,
      changePlan,
      clearCart,
      openCart: () => setDrawerOpen(true),
      closeCart: () => setDrawerOpen(false),
      setCouponCode: (code) => setCouponCodeState(code.toUpperCase().slice(0, 32)),
    }),
    [
      items,
      hydrated,
      drawerOpen,
      totalQuantity,
      totals,
      couponCode,
      addItem,
      removeItem,
      setQuantity,
      changePlan,
      clearCart,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartDrawer />
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
