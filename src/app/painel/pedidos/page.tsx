import { AppShell } from "@/core/app-shell";
import { ClientHubPage } from "@/modules/client-hub";

export default function ClientOrdersRoute() {
  return (
    <AppShell mode="client">
      <ClientHubPage initialTab="orders" />
    </AppShell>
  );
}
