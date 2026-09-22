export function env(name, aliases = []) {
  for (const key of [name, ...aliases]) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export const config = {
  token: env("DISCORD_TOKEN", ["TOKEN"]),
  clientId: env("DISCORD_CLIENT_ID", ["CLIENT_ID"]),
  guildId: env("DISCORD_GUILD_ID", ["GUILD_ID"]),
  ownerId: env("OWNER_ID"),
  supabaseUrl: env("SUPABASE_URL"),
  supabaseServiceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  workerId: env("WORKER_ID") || "crazzy-discord-main",
  sleepMs: Math.max(1000, Number(env("SLEEP_MS")) || 1800),
  pollMs: Math.max(3000, Number(env("POLL_MS")) || 5000),
};

export function assertConfig() {
  const missing = [];
  if (!config.token) missing.push("DISCORD_TOKEN");
  if (!config.clientId) missing.push("DISCORD_CLIENT_ID");
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) throw new Error("Missing env: " + missing.join(", "));
}
