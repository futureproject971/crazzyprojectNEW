import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { DiscordCampaignCenterPage } from "@/modules/discord-campaigns";

export const metadata: Metadata = {
  title: "Campanhas Discord | CRAZZY PROJECT",
  description: "Editor, templates e disparos do bot Discord.",
};

export default function AdminDiscordCampaignsRoute() {
  return (
    <AppShell mode="admin" activeNav="campaigns" showFooter={false}>
      <DiscordCampaignCenterPage />
    </AppShell>
  );
}
