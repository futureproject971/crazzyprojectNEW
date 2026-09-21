import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { LibraryPage } from "@/modules/library";

export const metadata: Metadata = {
  title: "Minha Library | CRAZZY PROJECT",
  description: "Revele e gerencie suas entregas digitais com segurança.",
};

export default function LibraryRoute() {
  return (
    <AppShell mode="client">
      <LibraryPage />
    </AppShell>
  );
}
