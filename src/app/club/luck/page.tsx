import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { LuckPage } from "@/modules/luck";

export const metadata: Metadata = {
  title: "CRAZZY LUCK | CRAZZY PROJECT",
  description: "Roleta, raspadinha, drops e prêmios do CRAZZY CLUB.",
};

export default function LuckRoute() {
  return (
    <AppShell mode="client" activeNav="club">
      <LuckPage />
    </AppShell>
  );
}
