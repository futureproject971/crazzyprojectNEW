import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { ResellerHubPage } from "@/modules/resellers";

export const metadata:Metadata={title:"Área do Revendedor | CRAZZY PROJECT"};

export default function ResellerRoute(){
  return <AppShell mode="client" activeNav="reseller"><ResellerHubPage/></AppShell>;
}
