import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { StockManagerPage } from "@/modules/stock-manager";

export const metadata: Metadata = {
  title: "Stock Manager | CRAZZY PROJECT",
  description: "Gerenciamento seguro de estoque e keys.",
};

export default function AdminStockRoute() {
  return (
    <AppShell mode="admin" activeNav="stock" showFooter={false}>
      <StockManagerPage />
    </AppShell>
  );
}
