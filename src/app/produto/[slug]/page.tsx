import { notFound } from "next/navigation";
import { AppShell } from "@/core/app-shell";
import { ProductView, getAllProductSlugs, getProductDetail } from "@/modules/product-view";

export function generateStaticParams() {
  return getAllProductSlugs().map((slug) => ({ slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = getProductDetail(slug);

  if (!detail) notFound();

  return (
    <AppShell mode="visitor" activeNav="products" cartCount={0}>
      <ProductView detail={detail} />
    </AppShell>
  );
}
