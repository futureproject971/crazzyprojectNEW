import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { NotificationsPage } from "@/modules/notifications";
export const metadata:Metadata={title:"Notificações | CRAZZY PROJECT"};
export default function NotificationsRoute(){return <AppShell mode="client" activeNav="notifications"><NotificationsPage/></AppShell>}
