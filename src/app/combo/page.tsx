import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { ComboBuilderPage } from "@/modules/cart";

export const metadata: Metadata = {
  title: "Monte seu Combo | CRAZZY PROJECT",
  description: "Monte combos Mensais ou Lifetime e desbloqueie até 35% OFF.",
};

export default function ComboRoute() {
  return (
    <AppShell mode="visitor" activeNav="combo">
      <ComboBuilderPage />
    </AppShell>
  );
}
