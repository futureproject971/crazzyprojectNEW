import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { AccountDetailView } from "@/modules/accounts-market";
import type { AccountsMarketGame } from "@/modules/accounts-market";

export const metadata: Metadata = {
  title: "Detalhes da Conta | CRAZZY PROJECT",
  description: "Detalhes, inventário e compra de conta na CRAZZY PROJECT.",
};

const games = new Set<AccountsMarketGame>(["valorant", "lol", "fortnite", "minecraft"]);

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ game?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const game = games.has(query.game as AccountsMarketGame)
    ? (query.game as AccountsMarketGame)
    : "valorant";

  return (
    <AppShell mode="visitor" activeNav="accounts" cartCount={0}>
      <AccountDetailView id={id} game={game} />
    </AppShell>
  );
}
