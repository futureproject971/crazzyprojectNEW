const { readFile } = await import("node:fs/promises");

const middleware = await readFile("src/lib/supabase/middleware.ts", "utf8");
if (!middleware.includes('"/call"')) {
  throw new Error("CRAZZY CALL must be protected by auth middleware");
}
console.log("[PASS] /call is protected by auth middleware");

const provider = await readFile("src/modules/auth/AuthProvider.tsx", "utf8");
for (const required of [
  'provider === "discord"',
  'scopes: provider === "discord" ? "identify email guilds"',
  'provider: "discord"',
  'linkIdentity',
]) {
  if (!provider.includes(required)) {
    throw new Error("Discord OAuth provider flow missing " + required);
  }
}
console.log("[PASS] Discord OAuth uses identify/email/guilds and supports account linking");

const callback = await readFile("src/app/auth/callback/route.ts", "utf8");
for (const required of [
  "exchangeCodeForSession",
  'expectedProvider === "discord"',
  "auth-discord-sync",
  "provider_token",
]) {
  if (!callback.includes(required)) {
    throw new Error("Discord callback missing " + required);
  }
}
if (/provider_token[^\n]{0,120}(insert|upsert|update)/i.test(callback)) {
  throw new Error("Provider token must not be persisted by callback");
}
console.log("[PASS] callback exchanges PKCE code and syncs Discord without persisting provider token");

const sync = await readFile("supabase/functions/auth-discord-sync/index.ts", "utf8");
for (const required of [
  '"/users/@me"',
  '"/users/@me/guilds"',
  "discord_identities",
  "DISCORD_GUILD_ID",
  "ACCOUNT_BANNED",
]) {
  if (!sync.includes(required)) {
    throw new Error("Discord sync function missing " + required);
  }
}
if (/provider_token\s*[:,][^\n]*(insert|upsert)/i.test(sync)) {
  throw new Error("Discord sync must not persist the provider token");
}
console.log("[PASS] Discord identity/guild sync stays server-side");

const hub = await readFile("src/modules/call/CallHubPage.tsx", "utf8");
if (!hub.includes("!user || !user.discord.connected")) {
  throw new Error("CRAZZY CALL hub must require Discord identity");
}
if (!hub.includes("user.discord.guildId && !user.discord.guildMember")) {
  throw new Error("CRAZZY CALL hub must honor configured guild membership");
}
console.log("[PASS] CRAZZY CALL hub requires Discord and honors guild membership");

const experience = await readFile("src/modules/call/CallExperience.tsx", "utf8");
if (!experience.includes("!user || !user.discord.connected")) {
  throw new Error("CRAZZY CALL room must require Discord identity");
}
if (!experience.includes("discord_guild_required")) {
  throw new Error("CRAZZY CALL room must surface guild membership requirement");
}
console.log("[PASS] direct room links redirect through Discord auth");

const authPage = await readFile("src/modules/auth/AuthPage.tsx", "utf8");
if (!authPage.includes("/brand/crazzy-logo-hero.png")) {
  throw new Error("Login must use the official CRAZZY PROJECT logo");
}
if (!authPage.includes("ATUALIZAR DISCORD")) {
  throw new Error("Login must support Discord re-sync");
}
console.log("[PASS] login uses official branding and supports Discord re-sync");

console.log("[PASS] Discord Auth + CRAZZY CALL gate smoke");
