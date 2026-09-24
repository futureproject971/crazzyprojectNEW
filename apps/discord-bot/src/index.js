import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { config, validateConfig } from "./config.js";
import { createBotSupabase } from "./supabase.js";
import {
  startCampaignWorker,
  startWorkerHeartbeat,
} from "./modules/campaigns.js";
import { startBuilderWorker } from "./modules/server-builder.js";
import { startDiscordRoleBridge } from "./modules/role-bridge.js";
import { startNotificationWorker } from "./modules/notifications.js";
import { startSecuritySentinel } from "./modules/security-sentinel.js";
import { ensureOfficialDiscordInvite, startPendingGuildVerifier } from "./modules/guild-gate.js";
import {
  deployCommands,
  installCommandHandlers,
} from "./modules/commands.js";

validateConfig();

const supabase = createBotSupabase(config);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Channel],
});

installCommandHandlers(client, supabase, config);

async function syncGuildMembership(member, guildMember) {
  if (!member?.guild || member.guild.id !== config.guildId) return;

  const now = new Date().toISOString();
  const payload = {
    guild_id: config.guildId,
    guild_member: guildMember,
    guild_verified_at: guildMember ? now : null,
    last_checked_at: now,
    updated_at: now,
  };

  const { error } = await supabase
    .from("discord_identities")
    .update(payload)
    .eq("discord_user_id", String(member.id));

  if (error) {
    console.error(
      "[guild-membership] failed to sync Discord member state:",
      member.id,
      error.code || error.message,
    );
  }
}

client.on("guildMemberAdd", (member) => {
  void syncGuildMembership(member, true);
});

client.on("guildMemberRemove", (member) => {
  void syncGuildMembership(member, false);
});

let stopCampaigns = null;
let stopBuilder = null;
let stopRoleBridge = null;
let stopNotifications = null;
let stopSecurity = null;
let stopHeartbeat = null;
let stopGuildGateVerifier = null;

client.once("ready", async () => {
  console.log("[core] CRAZZY PROJECT bot online as " + client.user.tag);

  try {
    await deployCommands(config);
  } catch (error) {
    console.error("[commands] deploy failed:", error);
  }

  await ensureOfficialDiscordInvite(client, supabase, config);
  stopGuildGateVerifier = startPendingGuildVerifier(client, supabase, config);
  stopHeartbeat = startWorkerHeartbeat(client, supabase, config);
  stopCampaigns = startCampaignWorker(client, supabase, config);
  stopBuilder = startBuilderWorker(client, supabase, config);
  stopRoleBridge = startDiscordRoleBridge(client, supabase, config);
  stopNotifications = startNotificationWorker(client, supabase, config);
  stopSecurity = startSecuritySentinel(client, supabase, config);
});

async function shutdown(signal) {
  console.log("[core] shutdown requested: " + signal);

  stopCampaigns?.();
  stopBuilder?.();
  stopRoleBridge?.();
  stopNotifications?.();
  stopSecurity?.();
  stopHeartbeat?.();
  stopGuildGateVerifier?.();

  try {
    await supabase
      .from("discord_campaign_worker_status")
      .update({
        connected: false,
        updated_at: new Date().toISOString(),
      })
      .eq("worker_id", config.workerId);
  } catch {
    // Best effort only.
  }

  client.destroy();
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

client.login(config.token).catch((error) => {
  console.error("[core] login failed:", error);
  process.exit(1);
});
