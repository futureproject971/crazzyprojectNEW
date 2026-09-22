import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { AdminCallsPage } from "@/modules/call";

export const metadata: Metadata = {
  title: "CRAZZY CALL Admin | CRAZZY PROJECT",
};

export default function AdminCallsRoute() {
  return (
    <AppShell mode="admin" activeNav="calls" showFooter={false}>
      <AdminCallsPage />
    </AppShell>
  );
}
