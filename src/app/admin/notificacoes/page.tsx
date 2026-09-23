import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { NotificationManagerPage } from "@/modules/notifications";
export const metadata:Metadata={title:"Notify Manager | CRAZZY PROJECT"};
export default function AdminNotificationsRoute(){return <AppShell mode="admin" activeNav="notifications" showFooter={false}><NotificationManagerPage/></AppShell>}
