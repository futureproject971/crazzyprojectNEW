import fs from "node:fs";
import path from "node:path";
import { config, validateConfig } from "../src/config.js";
import { createBotSupabase } from "../src/supabase.js";

validateConfig();

const input = process.argv[2] || "templates.json";
const file = path.resolve(process.cwd(), input);

if (!fs.existsSync(file)) {
  console.error("Legacy template file not found: " + file);
  process.exit(1);
}

const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
const templates = parsed?.templates && typeof parsed.templates === "object"
  ? parsed.templates
  : {};

const supabase = createBotSupabase(config);

let imported = 0;

for (const [name, item] of Object.entries(templates)) {
  const payload = {
    name: String(name).slice(0, 80),
    title: item?.title || null,
    description: item?.description || "",
    image_url: item?.image || null,
    thumbnail_url: null,
    link_url: item?.link || null,
    button_label: "🛒 Acessar Loja",
    footer_text: "CRAZZY PROJECT",
    color: Number(item?.color || 0x1687ff),
    active: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("discord_campaign_templates")
    .upsert(payload, { onConflict: "name" });

  if (error) {
    console.error("[FAIL] " + name + ": " + error.message);
    continue;
  }

  imported += 1;
  console.log("[OK] " + name);
}

console.log("Imported templates: " + imported);
