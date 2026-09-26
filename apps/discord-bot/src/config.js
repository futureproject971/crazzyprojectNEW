import dotenv from "dotenv";

dotenv.config();

function env(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function csv(name) {
  return env(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export const config = {
  token: env("DISCORD_BOT_TOKEN", env("TOKEN")),
  clientId: env("DISCORD_CLIENT_ID", env("CLIENT_ID")),
  guildId: env("DISCORD_GUILD_ID", env("GUILD_ID")),
  supabaseUrl: env("SUPABASE_URL"),
  supabaseServiceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  workerId: env("CRAZZY_DISCORD_WORKER_ID", "main"),
  siteUrl: env("CRAZZY_SITE_URL"),
  livekitUrl: env("LIVEKIT_URL"),
  livekitKey: env("LIVEKIT_API_KEY"),
  livekitSecret: env("LIVEKIT_API_SECRET"),
  dmDelayMs: Math.max(1000, Number(env("DISCORD_DM_DELAY_MS", "1500")) || 1500),
  adminUserIds: new Set(csv("DISCORD_ADMIN_USER_IDS")),
  adminRoleIds: new Set(csv("DISCORD_ADMIN_ROLE_IDS")),
};

export function validateConfig() {
  const required = [
    ["DISCORD_BOT_TOKEN", config.token],
    ["DISCORD_CLIENT_ID", config.clientId],
    ["DISCORD_GUILD_ID", config.guildId],
    ["SUPABASE_URL", config.supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", config.supabaseServiceRoleKey],
  ];

  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    throw new Error("Missing required environment variables: " + missing.join(", "));
  }
}
