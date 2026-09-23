import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { ResellerManagerPage } from "@/modules/resellers";

export const metadata:Metadata={title:"Resellers | CRAZZY PROJECT"};

export default function AdminResellersRoute(){
  return <AppShell mode="admin" activeNav="resellers" showFooter={false}><ResellerManagerPage/></AppShell>;
}
