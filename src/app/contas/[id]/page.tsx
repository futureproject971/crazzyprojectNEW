import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { AccountDetailView } from "@/modules/accounts-market";

export const metadata: Metadata = {
  title: "Detalhes da Conta | CRAZZY PROJECT",
  description: "Detalhes de conta no CRAZZY ACCOUNTS MARKET.",
};

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell mode="visitor" activeNav="accounts" cartCount={0}>
      <AccountDetailView id={id} />
    </AppShell>
  );
}
