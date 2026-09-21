import { AppShell } from "@/core/app-shell";
import { ClientHubPage } from "@/modules/client-hub";

export default function ClientProductsRoute() {
  return (
    <AppShell mode="client">
      <ClientHubPage initialTab="products" />
    </AppShell>
  );
}
