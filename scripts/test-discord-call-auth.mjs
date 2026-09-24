const { readFile } = await import("node:fs/promises");

const middleware = await readFile("src/lib/supabase/middleware.ts", "utf8");
for (const required of [
  '"/call"',
  '"/admin"',
  '"/api/client-hub"',
  '"/api/library"',
  '"/api/profile"',
  '"/api/support"',
  '"/api/reviews/eligible"',
  '"/api/academy/progress"',
  'pathname === "/api/luck"',
  'pathname === "/api/rewards"',
  'pathname === "/api/reviews"',
  "discord_identities",
  "guild_member",
]) {
  if (!middleware.includes(required)) {
    throw new Error("Discord-only middleware gate missing " + required);
  }
}
console.log("[PASS] private pages and authenticated APIs require Discord guild membership");

const provider = await readFile("src/modules/auth/AuthProvider.tsx", "utf8");
for (const required of [
  'signIn:(provider:"discord"',
  'provider:"discord"',
  'scopes:"identify email guilds"',
  "linkIdentity",
  "googleEnabled:false",
]) {
  if (!provider.includes(required)) {
    throw new Error("Discord OAuth provider flow missing " + required);
  }
}
if (provider.includes('provider:"google"') || provider.includes('signIn("google"')) {
  throw new Error("Google must not be an authentication provider in Discord-only mode");
}
console.log("[PASS] Discord is the only OAuth provider and requests identify/email/guilds");

const callback = await readFile("src/app/auth/callback/route.ts", "utf8");
for (const required of [
  "exchangeCodeForSession",
  'expectedProvider !== "discord"',
  "auth-discord-sync",
  "provider_token",
  "guildCheckConfigured",
  "guildMember",
  "/entrar/servidor",
]) {
  if (!callback.includes(required)) {
    throw new Error("Discord callback missing " + required);
  }
}
if (/provider_token[^\n]{0,120}(insert|upsert|update)/i.test(callback)) {
  throw new Error("Provider token must not be persisted by callback");
}
console.log("[PASS] callback exchanges PKCE code, syncs Discord and enforces official guild");

const sync = await readFile("supabase/functions/auth-discord-sync/index.ts", "utf8");
for (const required of [
  '"/users/@me"',
  '"/users/@me/guilds"',
  "discord_identities",
  "DISCORD_GUILD_ID",
  "ACCOUNT_BANNED",
  "CRAZZY_OWNER_DISCORD_ID",
  'role: "admin"',
  "ownerMatch",
  "officialGuildOwner",
  "officialGuild?.owner === true",
]) {
  if (!sync.includes(required)) {
    throw new Error("Discord sync function missing " + required);
  }
}
if (/provider_token\s*[:,][^\n]*(insert|upsert)/i.test(sync)) {
  throw new Error("Discord sync must not persist the provider token");
}
console.log("[PASS] Discord identity/guild sync stays server-side and owner admin bootstrap is explicit");

const authPage = await readFile("src/modules/auth/AuthPage.tsx", "utf8");
for (const required of [
  "/brand/crazzy-logo-hero.png",
  "ENTRAR COM DISCORD",
  "VERIFICAR DISCORD",
  "Discord é a identidade da CRAZZY PROJECT",
]) {
  if (!authPage.includes(required)) throw new Error("Discord login UI missing " + required);
}
console.log("[PASS] login is Discord-only and uses official CRAZZY PROJECT branding");

console.log("[PASS] Discord Auth + CRAZZY CALL guild gate smoke");
