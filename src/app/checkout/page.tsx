import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { CheckoutPage } from "@/modules/checkout";

export const metadata: Metadata = {
  title: "Checkout | CRAZZY PROJECT",
  description: "Checkout protegido CRAZZY PROJECT.",
};

export default function CheckoutRoute() {
  return (
    <AppShell mode="visitor" activeNav="cart">
      <CheckoutPage />
    </AppShell>
  );
}
