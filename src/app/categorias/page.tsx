import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { CategoryDirectoryPage } from "@/modules/category-manager";

export const metadata: Metadata = {
  title: "Categorias | CRAZZY PROJECT",
  description: "Explore as categorias disponíveis no CRAZZY PROJECT.",
};

export default function CategoriesPage() {
  return (
    <AppShell mode="visitor" activeNav="news">
      <CategoryDirectoryPage />
    </AppShell>
  );
}
