import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { AppearanceManagerPage } from "@/modules/appearance-manager";

export const metadata: Metadata = {
  title: "Appearance | CRAZZY PROJECT",
};

export default function AdminAppearanceRoute() {
  return (
    <AppShell mode="admin" activeNav="appearance" showFooter={false}>
      <AppearanceManagerPage />
    </AppShell>
  );
}
