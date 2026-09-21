import { AppShell } from "@/core/app-shell";
import { ClientHubPage } from "@/modules/client-hub";

export default function ClientDiscordRoute() {
  return (
    <AppShell mode="client">
      <ClientHubPage initialTab="discord" />
    </AppShell>
  );
}
