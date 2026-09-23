import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { SupportDeskPage } from "@/modules/support-desk";

export const metadata: Metadata = { title: "Support Desk | CRAZZY PROJECT" };

export default function AdminSupportRoute() {
  return <AppShell mode="admin" activeNav="support-desk" showFooter={false}><SupportDeskPage /></AppShell>;
}
