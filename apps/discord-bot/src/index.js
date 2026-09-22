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

let stopCampaigns = null;
let stopBuilder = null;
let stopHeartbeat = null;

client.once("ready", async () => {
  console.log("[core] CRAZZY PROJECT bot online as " + client.user.tag);

  try {
    await deployCommands(config);
  } catch (error) {
    console.error("[commands] deploy failed:", error);
  }

  stopHeartbeat = startWorkerHeartbeat(client, supabase, config);
  stopCampaigns = startCampaignWorker(client, supabase, config);
  stopBuilder = startBuilderWorker(client, supabase, config);
});

async function shutdown(signal) {
  console.log("[core] shutdown requested: " + signal);

  stopCampaigns?.();
  stopBuilder?.();
  stopHeartbeat?.();

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
