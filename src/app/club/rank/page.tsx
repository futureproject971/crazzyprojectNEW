import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { RankPage } from "@/modules/rank";

export const metadata: Metadata = {
  title: "CRAZZY RANK | CRAZZY PROJECT",
  description: "Rank, XP e leaderboard da comunidade CRAZZY PROJECT.",
};

export default function RankRoute() {
  return (
    <AppShell mode="client" activeNav="club">
      <RankPage />
    </AppShell>
  );
}
