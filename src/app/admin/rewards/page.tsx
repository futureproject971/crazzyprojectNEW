import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { RewardManagerPage } from "@/modules/reward-manager";
export const metadata: Metadata={title:"Reward Manager | CRAZZY PROJECT"};
export default function AdminRewards(){return <AppShell mode="admin" activeNav="rewards-manager" showFooter={false}><RewardManagerPage/></AppShell>}
