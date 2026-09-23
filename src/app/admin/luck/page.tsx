import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { LuckManagerPage } from "@/modules/luck-manager";
export const metadata:Metadata={title:"Luck Manager | CRAZZY PROJECT"};
export default function AdminLuck(){return <AppShell mode="admin" activeNav="luck-manager" showFooter={false}><LuckManagerPage/></AppShell>}
