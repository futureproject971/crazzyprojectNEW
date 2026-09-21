import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { StatusPage } from "@/modules/status";

export const metadata: Metadata = {
  title: "Status | CRAZZY PROJECT",
  description: "Disponibilidade e incidentes dos serviços da CRAZZY PROJECT.",
};

export default function StatusRoute() {
  return (
    <AppShell mode="visitor">
      <StatusPage />
    </AppShell>
  );
}
