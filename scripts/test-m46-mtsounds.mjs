const { readFile } = await import("node:fs/promises");

const page = await readFile("src/modules/mtsounds/MtSoundsPage.tsx", "utf8");
const api = await readFile("src/app/api/mtsounds/route.ts", "utf8");
const config = await readFile("src/lib/mtsounds/config.ts", "utf8");

for (const required of [
  "/api/mtsounds",
  "frameFailed",
  "M46 COMPAT",
  "sandbox=",
  "referrerPolicy=",
  "M46 fechado em modo compatibilidade",
]) {
  if (!page.includes(required)) throw new Error("M46 page missing " + required);
}

for (const forbidden of [
  "DISCORD_BOT_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LIVEKIT_API_SECRET",
]) {
  if (page.includes(forbidden) || api.includes(forbidden) || config.includes(forbidden)) {
    throw new Error("M46 must not couple to private CRAZZY secrets: " + forbidden);
  }
}

if (!config.includes('protocol !== "https:"')) {
  throw new Error("M46 partner URL must stay HTTPS-only");
}
if (!config.includes("AbortController")) {
  throw new Error("M46 health probe must have a timeout");
}
if (!api.includes("Cache-Control")) {
  throw new Error("M46 status endpoint should be cheaply cacheable");
}

console.log("[PASS] M46 MT Sounds compatibility module");
