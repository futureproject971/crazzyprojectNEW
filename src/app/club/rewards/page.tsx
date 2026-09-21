import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { RewardsPage } from "@/modules/rewards";

export const metadata: Metadata = {
  title: "CRAZZY REWARDS | CRAZZY PROJECT",
  description: "Missões e recompensas do CRAZZY CLUB.",
};

export default function RewardsRoute() {
  return (
    <AppShell mode="client" activeNav="club">
      <RewardsPage />
    </AppShell>
  );
}
