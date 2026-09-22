import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { FinanceManagerPage } from "@/modules/finance-manager";

export const metadata: Metadata = {
  title: "Finance | CRAZZY PROJECT",
  description: "Receita, taxas, reembolsos, disputas e resultado líquido.",
};

export default function AdminFinanceRoute() {
  return (
    <AppShell mode="admin" activeNav="finance" showFooter={false}>
      <FinanceManagerPage />
    </AppShell>
  );
}
