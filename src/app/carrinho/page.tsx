import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { CartPage } from "@/modules/cart";

export const metadata: Metadata = {
  title: "Carrinho | CRAZZY PROJECT",
  description: "Carrinho CRAZZY PROJECT com produtos, planos e combos.",
};

export default function CartRoute() {
  return (
    <AppShell mode="visitor" activeNav="cart">
      <CartPage />
    </AppShell>
  );
}
