const project = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const rest = project + "/rest/v1";
const key = "sb_publishable_Gu8G1uqggVf2pvVenX7EPQ_yIi5t2Kb";
const zero = "00000000-0000-4000-8000-000000000000";

async function req(path, init = {}) {
  return fetch(rest + path, {
    ...init,
    headers: {
      apikey: key,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
}

for (const table of [
  "discord_campaign_templates",
  "discord_campaigns",
  "discord_campaign_deliveries",
  "discord_campaign_worker_status",
  "discord_builder_configs",
  "discord_builder_jobs",
]) {
  const response = await req("/" + table + "?select=*&limit=1");
  if (response.ok) {
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length > 0) {
      throw new Error("Anonymous users can read " + table);
    }
  }
  console.log("[PASS] " + table + " exposes no anonymous rows");
}

for (const [name, body] of [
  ["queue_discord_campaign", {
    p_template_id: null,
    p_title: "anon",
    p_description: "anon",
    p_image_url: null,
    p_thumbnail_url: null,
    p_link_url: null,
    p_button_label: "Acessar",
    p_footer_text: null,
    p_color: 255,
    p_target_mode: "all",
    p_target_role_id: null,
    p_target_user_id: null,
    p_guild_id: null,
    p_scheduled_for: null,
  }],
  ["cancel_discord_campaign", { p_campaign_id: zero }],
  ["claim_discord_campaign", { p_worker_id: "anon" }],
  ["update_discord_campaign_progress", {
    p_campaign_id: zero,
    p_worker_id: "anon",
    p_total: 0,
    p_processed: 0,
    p_success: 0,
    p_failed: 0,
    p_skipped: 0,
  }],
  ["queue_discord_builder_job", { p_guild_id: null }],
  ["cancel_discord_builder_job", { p_job_id: zero }],
  ["claim_discord_builder_job", { p_worker_id: "anon" }],
  ["heartbeat_discord_bot_worker", {
    p_worker_id: "anon",
    p_guild_id: null,
    p_guild_name: null,
    p_bot_user_id: null,
    p_bot_tag: null,
    p_connected: false,
    p_member_count: 0,
    p_online_count: 0,
    p_roles: [],
    p_channels: [],
    p_version: "anon",
    p_last_error: null,
  }],
]) {
  const response = await req("/rpc/" + name, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (response.ok) {
    throw new Error(name + " must reject anonymous execution");
  }
  console.log("[PASS] " + name + " rejects anonymous access (" + response.status + ")");
}

const { readFile } = await import("node:fs/promises");

for (const file of [
  "src/app/api/admin/discord-campaigns/route.ts",
  "src/modules/discord-campaigns/DiscordCampaignCenterPage.tsx",
  "src/modules/discord-campaigns/DiscordEmbedPreview.tsx",
  "src/modules/community/CommunityVoiceDock.tsx",
  "src/app/api/admin/discord-bot/route.ts",
  "src/modules/discord-bot-core/DiscordBotCorePage.tsx",
]) {
  const content = await readFile(file, "utf8");
  for (const secret of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "DISCORD_BOT_TOKEN",
  ]) {
    if (content.includes(secret)) {
      throw new Error(file + " must not reference server-only secret " + secret);
    }
  }
}
console.log("[PASS] site/client integration does not reference bot/service secrets");

const botConfig = await readFile("apps/discord-bot/src/config.js", "utf8");
if (!botConfig.includes("DISCORD_BOT_TOKEN")) {
  throw new Error("Unified bot must use DISCORD_BOT_TOKEN");
}
if (botConfig.includes("DISCORD_BOT_TOKEN_2") || botConfig.includes("SECOND_BOT_TOKEN")) {
  throw new Error("Unified bot must not define extra bot tokens");
}
console.log("[PASS] unified Discord worker uses one official bot token");

const campaignWorker = await readFile("apps/discord-bot/src/modules/campaigns.js", "utf8");
for (const required of [
  "claim_discord_campaign",
  "update_discord_campaign_progress",
  "finish_discord_campaign",
  "heartbeat_discord_bot_worker",
]) {
  if (!campaignWorker.includes(required)) {
    throw new Error("Unified campaign worker missing " + required);
  }
}
if (campaignWorker.includes("templates.json")) {
  throw new Error("Unified bot must not use templates.json as source of truth");
}
console.log("[PASS] campaigns use Supabase queue/state instead of local templates.json");

const builderWorker = await readFile("apps/discord-bot/src/modules/server-builder.js", "utf8");
for (const required of [
  "claim_discord_builder_job",
  "finish_discord_builder_job",
  "SAFE_MODE_REQUIRED",
  "append_only",
]) {
  if (!builderWorker.includes(required)) {
    throw new Error("Unified Server Builder missing " + required);
  }
}
for (const forbidden of [
  ".delete(",
  ".setParent(",
  ".setPosition(",
  "bulkDelete(",
]) {
  if (builderWorker.includes(forbidden)) {
    throw new Error("Server Builder SAFE MODE contains destructive mutation: " + forbidden);
  }
}
console.log("[PASS] Server Builder is inside the same Bot Core and remains append-only");

const botIndex = await readFile("apps/discord-bot/src/index.js", "utf8");
const loginCount = (botIndex.match(/client\.login\(/g) || []).length;
if (loginCount !== 1) {
  throw new Error("Bot Core must have exactly one Discord Gateway login, found " + loginCount);
}
if (!botIndex.includes("startCampaignWorker") || !botIndex.includes("startBuilderWorker")) {
  throw new Error("Single Bot Core must start both Campaigns and Server Builder modules");
}
console.log("[PASS] one Gateway login runs multiple Discord modules");

const preview = await readFile("src/modules/discord-campaigns/DiscordEmbedPreview.tsx", "utf8");
for (const feature of [
  "thumbnailUrl",
  "buttonLabel",
  "footerText",
  "colorHex",
]) {
  if (!preview.includes(feature)) {
    throw new Error("Discord preview missing " + feature);
  }
}
console.log("[PASS] site has live Discord-style embed preview");

const community = await readFile("src/modules/community/CommunityVoiceDock.tsx", "utf8");
for (const feature of ["Voz, câmera e screen share", "/api/call/create", "/call/"]) {
  if (!community.includes(feature)) {
    throw new Error("Community voice integration missing " + feature);
  }
}
console.log("[PASS] CRAZZY Community links text ecosystem with CRAZZY CALL");

console.log("[PASS] Unified Discord + CRAZZY CALL integration smoke");
