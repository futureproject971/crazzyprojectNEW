import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { BonusPage } from "@/modules/bonus";
export const metadata:Metadata={title:"CRAZZY BONUS | CRAZZY PROJECT",description:"Carteira promocional CRAZZY BONUS."};
export default function BonusRoute(){return <AppShell mode="client" activeNav="club"><BonusPage/></AppShell>}
