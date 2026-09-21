import fs from "node:fs/promises";

const nav = await fs.readFile("src/core/app-shell/navigation.ts", "utf8");
const page = await fs.readFile("src/modules/mtsounds/MtSoundsPage.tsx", "utf8");

const visitorMatch = nav.match(/export const visitorNavigation:[\s\S]*?= \[([\s\S]*?)\];/);
if (!visitorMatch) throw new Error("visitorNavigation not found");

const visitorBody = visitorMatch[1];
const entries = [...visitorBody.matchAll(/\{ id: "([^"]+)",[^\n]+\}/g)].map(match => match[1]);
if (!entries.length || entries[entries.length - 1] !== "mtsounds") {
  throw new Error("MT Sounds must be the last public navigation item");
}
console.log("[PASS] MT Sounds is the final public nav item");

if (!page.includes("https://mtsounds.vercel.app/")) {
  throw new Error("Partner URL missing");
}
if (!page.includes('sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"')) {
  throw new Error("Controlled iframe sandbox missing");
}
if (!page.includes("Ferramenta de parceiro")) {
  throw new Error("Partner branding disclosure missing");
}
console.log("[PASS] partner branding and isolated iframe shell are present");

console.log("[PASS] M23.1 MT Sounds partner smoke");
