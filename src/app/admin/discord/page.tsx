import type { Metadata } from "next";
import { AppShell } from "@/core/app-shell";
import { DiscordBotCorePage } from "@/modules/discord-bot-core";

export const metadata: Metadata = {
  title: "Discord Bot Core | CRAZZY PROJECT",
  description: "Painel unificado do bot Discord da CRAZZY PROJECT.",
};

export default function DiscordBotCoreRoute() {
  return (
    <AppShell mode="admin" activeNav="discord" showFooter={false}>
      <DiscordBotCorePage />
    </AppShell>
  );
}
