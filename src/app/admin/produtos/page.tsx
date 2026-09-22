import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { ProductManagerPage } from "@/modules/product-manager";

export const metadata: Metadata = {
  title: "Product Manager | CRAZZY PROJECT",
  description: "Gerenciamento administrativo de produtos e planos.",
};

export default function AdminProductsRoute() {
  return (
    <AppShell mode="admin" activeNav="products" showFooter={false}>
      <ProductManagerPage />
    </AppShell>
  );
}
