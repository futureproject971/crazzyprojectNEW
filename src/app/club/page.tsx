import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { ClubHubPage } from "@/modules/club";

export const metadata: Metadata = {
  title: "CRAZZY CLUB | CRAZZY PROJECT",
  description: "Hub de recompensas, cupons, sorteios e progressão da CRAZZY PROJECT.",
};

export default function ClubPage() {
  return (
    <AppShell mode="client" activeNav="club">
      <ClubHubPage />
    </AppShell>
  );
}
