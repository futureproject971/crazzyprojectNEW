import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { CategoryManagerPage } from "@/modules/category-manager";

export const metadata: Metadata = {
  title: "Category Manager | CRAZZY PROJECT",
  description: "Gerenciamento de categorias e jogos do CRAZZY PROJECT.",
};

export default function AdminCategoriesRoute() {
  return (
    <AppShell mode="admin" activeNav="categories" showFooter={false}>
      <CategoryManagerPage />
    </AppShell>
  );
}
