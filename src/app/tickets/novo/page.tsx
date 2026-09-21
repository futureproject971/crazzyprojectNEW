import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { NewTicketPage } from "@/modules/support";

export const metadata: Metadata = {
  title: "Novo Ticket | CRAZZY PROJECT",
};

export default function NewTicketRoute() {
  return (
    <AppShell mode="client" activeNav="support">
      <NewTicketPage />
    </AppShell>
  );
}
