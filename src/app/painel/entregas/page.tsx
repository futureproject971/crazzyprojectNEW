import { AppShell } from "@/core/app-shell";
import { ClientHubPage } from "@/modules/client-hub";

export default function ClientDeliveriesRoute() {
  return (
    <AppShell mode="client">
      <ClientHubPage initialTab="deliveries" />
    </AppShell>
  );
}
