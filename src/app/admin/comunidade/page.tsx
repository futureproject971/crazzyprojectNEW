import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { CommunityModPage } from "@/modules/community-mod";

export const metadata:Metadata={title:"Community Mod | CRAZZY PROJECT"};

export default function AdminCommunityModRoute(){
  return <AppShell mode="admin" activeNav="community-mod" showFooter={false}><CommunityModPage/></AppShell>;
}
