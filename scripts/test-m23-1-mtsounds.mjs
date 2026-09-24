import fs from "node:fs/promises";

const nav = await fs.readFile("src/core/app-shell/navigation.ts", "utf8");
const page = await fs.readFile("src/modules/mtsounds/MtSoundsPage.tsx", "utf8");

const visitorMatch = nav.match(/export const visitorNavigation:[\s\S]*?= \[([\s\S]*?)\];/);
if (!visitorMatch) throw new Error("visitorNavigation not found");
const visitorBody = visitorMatch[1];
const entries = [...visitorBody.matchAll(/\{ id: "([^"]+)",[^\n]+\}/g)].map(match => match[1]);
if (!entries.length || entries[entries.length - 1] !== "mtsounds") throw new Error("MTSOUNDS must be the last public navigation item");
if (!visitorBody.includes('label: "MTSOUNDS"') || !visitorBody.includes('badge: "GRÁTIS"')) throw new Error("MTSOUNDS nav must expose official label and free badge");
console.log("[PASS] MTSOUNDS is the final public nav item with GRÁTIS badge");

for (const required of [
  '"use client"',
  'params.get("via")',
  '"/api/referral/capture"',
  './native/MusicSearch',
  './native/ReactiveVinyl',
  '"/mtsounds/editor"',
  'crz-mts-native',
]) {
  if (!page.includes(required)) throw new Error("MTSOUNDS native integration missing " + required);
}
if (page.includes("<iframe") || page.includes("mtsounds.vercel.app")) {
  throw new Error("MTSOUNDS public experience must be native, not the legacy iframe");
}
console.log("[PASS] native MTSOUNDS source, partner attribution and CRAZZY route integration are present");

for (const forbidden of ["SUPABASE_SERVICE_ROLE_KEY","DISCORD_BOT_TOKEN","LIVEKIT_API_SECRET"]) {
  if (page.includes(forbidden)) throw new Error("MTSOUNDS client must not expose " + forbidden);
}
console.log("[PASS] M23.1 MTSOUNDS integration smoke");
