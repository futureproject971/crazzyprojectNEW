import type {Metadata} from "next";
import {AppShell} from "@/core/app-shell";
import {PartnerManagerPage} from "@/modules/partner-manager";
export const metadata:Metadata={title:"Parceiros | CRAZZY PROJECT"};
export default function AdminPartners(){return <AppShell mode="admin" activeNav="partners" showFooter={false}><PartnerManagerPage/></AppShell>}
