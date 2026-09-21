import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { ClientHubPage } from "@/modules/client-hub";

export const metadata: Metadata = {
  title: "Meu Painel | CRAZZY PROJECT",
  description: "Compras, produtos, tutoriais, entregas e Discord em um só lugar.",
};

export default async function ClientHubRoute({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const query = await searchParams;
  const allowed = ["overview", "orders", "products", "tutorials", "deliveries", "discord"] as const;
  const requested = query.tab;
  const initialTab = allowed.includes(requested as (typeof allowed)[number])
    ? (requested as (typeof allowed)[number])
    : "overview";

  return (
    <AppShell mode="client">
      <ClientHubPage initialTab={initialTab} />
    </AppShell>
  );
}
