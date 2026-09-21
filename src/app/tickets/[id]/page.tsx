import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { TicketThreadPage } from "@/modules/support";

export const metadata: Metadata = {
  title: "Ticket | CRAZZY PROJECT",
};

export default async function TicketRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell mode="client" activeNav="support">
      <TicketThreadPage ticketId={id} />
    </AppShell>
  );
}
