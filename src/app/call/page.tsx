import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { CallHubPage } from "@/modules/call";

export const metadata: Metadata = {
  title: "CRAZZY CALL | CRAZZY PROJECT",
  description: "Chamadas e compartilhamento em tempo real.",
};

export default function CallHubRoute() {
  return (
    <AppShell mode="visitor" activeNav="call">
      <CallHubPage />
    </AppShell>
  );
}
