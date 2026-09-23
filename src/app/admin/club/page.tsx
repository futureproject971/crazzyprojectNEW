import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { ClubManagerPage } from "@/modules/club-manager";

export const metadata: Metadata = {
  title: "Club Manager | CRAZZY PROJECT",
};

export default function AdminClubRoute() {
  return (
    <AppShell mode="admin" activeNav="club-manager" showFooter={false}>
      <ClubManagerPage />
    </AppShell>
  );
}
