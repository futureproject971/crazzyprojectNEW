import { AppShell } from "@/core/app-shell";
import { ClientHubPage } from "@/modules/client-hub";

export default function ClientTutorialsRoute() {
  return (
    <AppShell mode="client">
      <ClientHubPage initialTab="tutorials" />
    </AppShell>
  );
}
