import { AppShell } from "@/core/app-shell";
import { DiscoveryPage } from "@/modules/discovery";

export default function NewsPage() {
  return (
    <AppShell mode="visitor" activeNav="news" cartCount={0}>
      <DiscoveryPage />
    </AppShell>
  );
}
