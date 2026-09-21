import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { ControlCenterPage } from "@/modules/control-center";

export const metadata: Metadata = {
  title: "Control Center | CRAZZY PROJECT",
  description: "Painel operacional administrativo da CRAZZY PROJECT.",
};

export default function AdminControlCenterRoute() {
  return (
    <AppShell mode="admin" activeNav="admin" showFooter={false}>
      <ControlCenterPage />
    </AppShell>
  );
}
