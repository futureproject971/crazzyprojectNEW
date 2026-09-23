import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { FulfillmentManagerPage } from "@/modules/fulfillment-manager";

export const metadata:Metadata={title:"Fulfillment Engine | CRAZZY PROJECT"};

export default function AdminFulfillment(){
  return <AppShell mode="admin" activeNav="fulfillment" showFooter={false}><FulfillmentManagerPage/></AppShell>;
}
