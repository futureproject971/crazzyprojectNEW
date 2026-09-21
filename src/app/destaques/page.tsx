import { AppShell } from "@/core/app-shell";
import { DiscoveryPage } from "@/modules/discovery";

export default function HighlightsPage() {
  return (
    <AppShell mode="visitor" activeNav="news" cartCount={0}>
      <DiscoveryPage variant="highlights" />
    </AppShell>
  );
}
