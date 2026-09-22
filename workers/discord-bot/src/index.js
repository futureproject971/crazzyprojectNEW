import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} from "discord.js";
import { config, assertConfig } from "./config.js";
import { commandDefinitions } from "./commands.js";
import {
  handleCampaignInteraction,
  heartbeatCampaignWorker,
  pollCampaignQueue,
} from "./modules/campaigns.js";
import { handleBuilderInteraction } from "./modules/server-builder.js";

assertConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

async function deployCommands() {
  const rest = new REST({ version: "10" }).setToken(config.token);
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body: commandDefinitions() });
  console.log(
    "[bot-core] Slash commands registrados em " +
      (config.guildId ? "guild " + config.guildId : "GLOBAL")
  );
}

client.once("ready", async () => {
  console.log("[bot-core] CRAZZY PROJECT online como " + client.user.tag);

  try {
    await deployCommands();
  } catch (error) {
    console.error("[bot-core] Falha registrando commands", error);
  }

  try {
    await heartbeatCampaignWorker(client);
  } catch (error) {
    console.error("[bot-core] Falha no heartbeat inicial", error);
  }

  setInterval(() => {
    void pollCampaignQueue(client).catch((error) =>
      console.error("[bot-core] campaign poll", error)
    );
  }, config.pollMs);

  setInterval(() => {
    void heartbeatCampaignWorker(client).catch((error) =>
      console.error("[bot-core] heartbeat", error)
    );
  }, 30000);
});

client.on("interactionCreate", async (interaction) => {
  try {
    const builderHandled = await handleBuilderInteraction(interaction);
    if (builderHandled) return;

    const campaignHandled = await handleCampaignInteraction(interaction);
    if (campaignHandled) return;
  } catch (error) {
    console.error("[bot-core] interaction", error);

    const message = "❌ O módulo encontrou um erro. O evento foi registrado no log do Bot Core.";
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: message, ephemeral: true });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    } catch {
      // Never crash the Gateway connection because an interaction reply failed.
    }
  }
});

client.on("error", (error) => {
  console.error("[bot-core] Discord client error", error);
});

process.on("unhandledRejection", (error) => {
  console.error("[bot-core] unhandledRejection", error);
});

process.on("uncaughtException", (error) => {
  console.error("[bot-core] uncaughtException", error);
});

await client.login(config.token);
