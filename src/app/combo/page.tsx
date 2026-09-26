import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { ComboBuilderPage } from "@/modules/cart";

export const metadata: Metadata = {
  title: "Monte seu Combo | CRAZZY PROJECT",
  description: "Combine produtos do catálogo nos planos Mensal ou Lifetime e confira os descontos da loja.",
};

export default function ComboRoute() {
  return (
    <AppShell mode="visitor" activeNav="combo">
      <ComboBuilderPage />
    </AppShell>
  );
}
