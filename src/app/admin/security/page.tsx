import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { SecuritySentinelPage } from "@/modules/security-sentinel";

export const metadata:Metadata={title:"Security Sentinel | CRAZZY PROJECT"};

export default function AdminSecurity(){
  return <AppShell mode="admin" activeNav="security" showFooter={false}><SecuritySentinelPage/></AppShell>;
}
