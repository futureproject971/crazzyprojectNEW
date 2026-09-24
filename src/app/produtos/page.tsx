import { AppShell } from "@/core/app-shell";
import { CatalogPage } from "@/modules/catalog";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string | string[] }>;
}) {
  const params = await searchParams;
  const game = Array.isArray(params.game) ? params.game[0] : params.game;

  return (
    <AppShell mode="visitor" activeNav="products" cartCount={0}>
      <CatalogPage initialCategory={game || "all"} />
    </AppShell>
  );
}
