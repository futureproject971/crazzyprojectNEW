import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { SalesManagerPage } from "@/modules/sales-manager";

export const metadata: Metadata = {
  title: "Sales Manager | CRAZZY PROJECT",
  description: "Visão administrativa de vendas e entrega.",
};

export default function AdminSalesRoute() {
  return (
    <AppShell mode="admin" activeNav="sales" showFooter={false}>
      <SalesManagerPage />
    </AppShell>
  );
}
