import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { Customer360Page } from "@/modules/customer-360";

export const metadata: Metadata = { title: "Customer 360 | CRAZZY PROJECT" };

export default function AdminCustomersRoute() {
  return <AppShell mode="admin" activeNav="customers" showFooter={false}><Customer360Page /></AppShell>;
}
