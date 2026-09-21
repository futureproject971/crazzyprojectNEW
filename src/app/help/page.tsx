import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { HelpPage } from "@/modules/help";

export const metadata: Metadata = {
  title: "Ajuda | CRAZZY PROJECT",
  description: "Central de ajuda, FAQ e tutoriais públicos da CRAZZY PROJECT.",
};

export default function HelpRoute() {
  return (
    <AppShell mode="visitor" activeNav="help">
      <HelpPage />
    </AppShell>
  );
}
