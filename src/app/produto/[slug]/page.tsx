import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/core/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizePublicCatalog, type PublicStoreProduct } from "@/modules/catalog/live";
import { ProductView } from "@/modules/product-view";

export const dynamic = "force-dynamic";

async function loadCatalog(): Promise<PublicStoreProduct[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_store_catalog");
  if (error) return [];
  return normalizePublicCatalog(data);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await loadCatalog();
  const product = catalog.find((item) => item.slug === slug);

  if (!product) {
    return { title: "Produto não encontrado | CRAZZY PROJECT" };
  }

  return {
    title: product.name + " | CRAZZY PROJECT",
    description: product.description || "Produto CRAZZY PROJECT.",
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalog = await loadCatalog();
  const product = catalog.find((item) => item.slug === slug);
  if (!product) notFound();

  const sameGame = catalog.filter(
    (item) => item.id !== product.id && item.game?.id === product.game?.id
  );
  const others = catalog.filter(
    (item) => item.id !== product.id && item.game?.id !== product.game?.id
  );
  const relatedProducts = [...sameGame, ...others].slice(0, 4);

  return (
    <AppShell mode="visitor" activeNav="products" cartCount={0}>
      <ProductView product={product} relatedProducts={relatedProducts} />
    </AppShell>
  );
}
