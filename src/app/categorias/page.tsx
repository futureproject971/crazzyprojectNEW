import { AppShell } from "@/core/app-shell";
import { DiscoveryPage } from "@/modules/discovery";

export default function CategoriesPage() {
  return (
    <AppShell mode="visitor" activeNav="news" cartCount={0}>
      <DiscoveryPage variant="categories" />
    </AppShell>
  );
}
