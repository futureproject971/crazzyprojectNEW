import type {Metadata} from "next";
import {AppShell} from "@/core/app-shell";
import {PartnerHubPage} from "@/modules/partner-manager";
export const metadata:Metadata={title:"Painel do Parceiro | CRAZZY PROJECT"};
export default function PartnerPage(){return <AppShell mode="client" activeNav="partner"><PartnerHubPage/></AppShell>}
