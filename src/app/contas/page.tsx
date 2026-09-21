import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { AccountsMarketPage } from "@/modules/accounts-market";

export const metadata: Metadata = {
  title: "Contas de Jogos | CRAZZY PROJECT",
  description: "CRAZZY ACCOUNTS MARKET com integração LZT.",
};

export default function AccountsPage() {
  return (
    <AppShell mode="visitor" activeNav="accounts" cartCount={0}>
      <AccountsMarketPage />
    </AppShell>
  );
}
