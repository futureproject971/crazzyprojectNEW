import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { SupportListPage } from "@/modules/support";

export const metadata: Metadata = {
  title: "Meus Tickets | CRAZZY PROJECT",
  description: "Acompanhe suas conversas com o suporte CRAZZY PROJECT.",
};

export default function TicketsPage() {
  return (
    <AppShell mode="client" activeNav="support">
      <SupportListPage />
    </AppShell>
  );
}
