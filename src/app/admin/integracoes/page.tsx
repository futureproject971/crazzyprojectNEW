import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { IntegrationsPage } from "@/modules/integrations";
export const metadata:Metadata={title:"Integrações | CRAZZY PROJECT"};
export default function AdminIntegrations(){return <AppShell mode="admin" activeNav="integrations" showFooter={false}><IntegrationsPage/></AppShell>}
