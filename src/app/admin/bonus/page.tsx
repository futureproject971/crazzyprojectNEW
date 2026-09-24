import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { BonusManagerPage } from "@/modules/bonus-manager";
export const metadata:Metadata={title:"Bonus Manager | CRAZZY PROJECT"};
export default function AdminBonus(){return <AppShell mode="admin" activeNav="bonus-manager" showFooter={false}><BonusManagerPage/></AppShell>}
