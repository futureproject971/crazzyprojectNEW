import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { CouponWalletPage } from "@/modules/coupons";

export const metadata: Metadata = {
  title: "Meus Cupons | CRAZZY PROJECT",
  description: "Carteira de cupons da CRAZZY PROJECT.",
};

export default function CouponsRoute() {
  return (
    <AppShell mode="client" activeNav="club">
      <CouponWalletPage />
    </AppShell>
  );
}
