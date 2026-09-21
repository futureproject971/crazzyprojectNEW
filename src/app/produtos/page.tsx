import { AppShell } from "@/core/app-shell";
import { CatalogPage } from "@/modules/catalog";

export default function ProductsPage() {
  return (
    <AppShell mode="visitor" activeNav="products" cartCount={0}>
      <CatalogPage />
    </AppShell>
  );
}
