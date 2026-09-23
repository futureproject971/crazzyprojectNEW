import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { DiscordBridgePage } from "@/modules/discord-bridge";

export const metadata:Metadata={title:"Discord Bridge | CRAZZY PROJECT"};

export default function AdminBridge(){
  return <AppShell mode="admin" activeNav="discord-bridge" showFooter={false}><DiscordBridgePage/></AppShell>;
}
