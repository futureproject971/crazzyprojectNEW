import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

type RecordValue = Record<string, unknown>;
type Category = "riot" | "fortnite" | "minecraft";

const categoryPath: Record<Category, string> = {
  riot: "riot",
  fortnite: "fortnite",
  minecraft: "minecraft",
};

const commonScalar = [
  "page", "pmin", "pmax", "title", "order_by", "nsb", "sb",
  "nsb_by_me", "sb_by_me", "email_login_data", "item_domain",
  "parse_same_item_ids",
];

const commonArrays = [
  "email_type[]", "email_provider[]", "country[]", "not_country[]",
];

const riotScalar = [
  "rmin", "rmax", "last_rmin", "last_rmax", "previous_rmin", "previous_rmax",
  "valorant_level_min", "valorant_level_max", "lol_level_min", "lol_level_max",
  "inv_min", "inv_max", "vp_min", "vp_max", "valorant_smin", "valorant_smax",
  "amin", "amax", "knife", "lol_smin", "lol_smax", "champion_min", "champion_max",
  "win_rate_min", "win_rate_max", "blue_min", "blue_max", "orange_min", "orange_max",
  "mythic_min", "mythic_max", "riot_min", "riot_max", "email", "tel",
  "valorant_knife_min", "valorant_knife_max", "rp_min", "rp_max", "fa_min", "fa_max",
];

const riotArrays = [
  "weaponSkin[]", "buddy[]", "agent[]", "champion[]", "skin[]",
  "valorant_rank_type[]", "valorant_region[]", "valorant_not_region[]",
  "lol_region[]", "lol_not_region[]", "lol_rank[]",
];

const fortniteScalar = [
  "eg", "smin", "smax", "vbmin", "vbmax", "change_email",
  "skins_shop_min", "skins_shop_max", "pickaxes_shop_min", "pickaxes_shop_max",
  "bp", "lmin", "lmax", "bp_lmin", "bp_lmax", "last_trans_date",
  "last_trans_date_period", "no_trans", "xbox_linkable", "psn_linkable",
  "daybreak", "rl_purchases", "reg", "reg_period",
];

const fortniteArrays = ["skin[]", "pickaxe[]", "glider[]", "dance[]", "platform[]"];

const minecraftScalar = [
  "subscription", "subscription_length", "subscription_period", "autorenewal",
  "java", "bedrock", "dungeons", "legends", "change_nickname",
  "capes_min", "capes_max", "hypixel_ban", "hypixel_skyblock_api_enabled",
  "level_hypixel_min", "level_hypixel_max", "achievement_hypixel_min",
  "achievement_hypixel_max", "level_hypixel_skyblock_min", "level_hypixel_skyblock_max",
  "net_worth_hypixel_skyblock_min", "net_worth_hypixel_skyblock_max",
  "reg", "reg_period", "last_login_hypixel", "last_login_hypixel_period",
  "can_change_details", "nickname_length_min", "nickname_length_max",
  "hypixel_ban_parsed", "minecoins_min", "minecoins_max",
];

const minecraftArrays = ["capes[]", "rank_hypixel[]"];

const sensitiveKey = /(password|passwd|cookie|token|secret|credential|login_data|auth_data|email_pass|mail_pass|refresh|access_token|account_data)/i;

function objectValue(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : {};
}

function first(source: RecordValue, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function safeCount(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value as object).length;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function sanitizedFields(source: RecordValue) {
  return Object.keys(source)
    .filter((key) => !sensitiveKey.test(key))
    .sort()
    .slice(0, 180);
}

function publicItem(raw: unknown, category: Category) {
  const item = objectValue(raw);
  const itemId = first(item, ["item_id", "itemId", "id"]);
  const title = first(item, ["title", "title_en", "name"]);

  return {
    id: itemId == null ? null : String(itemId),
    title: title == null ? null : String(title),
    category,
    region: first(item, [
      "valorant_region", "lol_region", "region", "fortnite_region",
      "country", "minecraft_country",
    ]),
    rank: first(item, [
      "valorant_rank", "valorant_rank_name", "lol_rank", "rank", "rank_name",
    ]),
    level: first(item, [
      "valorant_level", "lol_level", "level", "fortnite_level", "minecraft_level",
      "hypixel_level",
    ]),
    skinsCount: safeCount(first(item, [
      "valorant_skins", "weaponSkins", "weapon_skins", "skins", "skin_count",
      "skins_count", "fortnite_skins", "lol_skins",
    ])),
    knivesCount: safeCount(first(item, [
      "valorant_knives", "knives", "knife_count", "valorant_knife_count",
    ])),
    agentsCount: safeCount(first(item, ["agents", "valorant_agents", "agent_count", "agents_count"])),
    championsCount: safeCount(first(item, ["champions", "champion_count", "champions_count"])),
    vbucks: first(item, ["vbucks", "v_bucks", "fortnite_vbucks"]),
    minecoins: first(item, ["minecoins", "minecraft_minecoins"]),
    capesCount: safeCount(first(item, ["capes", "cape_count", "capes_count"])),
    editions: {
      java: first(item, ["java", "minecraft_java"]),
      bedrock: first(item, ["bedrock", "minecraft_bedrock"]),
      dungeons: first(item, ["dungeons", "minecraft_dungeons"]),
      legends: first(item, ["legends", "minecraft_legends"]),
    },
  };
}

function appendAllowed(target: URLSearchParams, source: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = source.get(key);
    if (value !== null && value !== "") target.set(key, value);
  }
}

function appendAllowedArrays(target: URLSearchParams, source: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    for (const value of source.getAll(key)) {
      if (value) target.append(key, value);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const providerToken = Deno.env.get("LZT_MARKET_TOKEN");
  if (!providerToken) return json({ error: "Provider unavailable" }, 503);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "list";
  const categoryInput = url.searchParams.get("category") || "riot";

  if (!["riot", "fortnite", "minecraft"].includes(categoryInput)) {
    return json({ error: "Unsupported category" }, 400);
  }
  const category = categoryInput as Category;

  const headers = {
    Authorization: `Bearer ${providerToken}`,
    Accept: "application/json",
  };

  try {
    if (action === "detail") {
      const itemId = url.searchParams.get("item_id");
      if (!itemId || !/^\d+$/.test(itemId)) return json({ error: "Invalid item id" }, 400);

      const provider = await fetch(`https://api.lzt.market/${encodeURIComponent(itemId)}`, { headers });
      if (!provider.ok) return json({ error: "Provider request failed", status: provider.status }, provider.status === 404 ? 404 : 502);

      const raw = await provider.json();
      return json({ item: publicItem(raw, category), source: "lzt", preview: true });
    }

    if (action !== "list") return json({ error: "Unsupported action" }, 400);

    const query = new URLSearchParams();
    appendAllowed(query, url.searchParams, commonScalar);
    appendAllowedArrays(query, url.searchParams, commonArrays);

    if (category === "riot") {
      appendAllowed(query, url.searchParams, riotScalar);
      appendAllowedArrays(query, url.searchParams, riotArrays);
      const game = url.searchParams.get("game");
      if (game === "valorant") query.append("riot_game[]", "valorant");
      if (game === "lol") query.append("riot_game[]", "league-of-legends");
    }

    if (category === "fortnite") {
      appendAllowed(query, url.searchParams, fortniteScalar);
      appendAllowedArrays(query, url.searchParams, fortniteArrays);
    }

    if (category === "minecraft") {
      appendAllowed(query, url.searchParams, minecraftScalar);
      appendAllowedArrays(query, url.searchParams, minecraftArrays);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRole);
    const { data: config } = await supabase
      .from("lzt_config")
      .select("max_fetch_price")
      .limit(1)
      .maybeSingle();

    const maxFetch = config?.max_fetch_price != null ? Number(config.max_fetch_price) : 500;
    const requestedPmax = Number(url.searchParams.get("pmax") || maxFetch);
    const effectivePmax = Math.min(
      Number.isFinite(requestedPmax) && requestedPmax > 0 ? requestedPmax : maxFetch,
      maxFetch
    );

    query.set("pmax", String(Math.round(effectivePmax)));
    query.set("currency", "rub");
    if (!query.has("page")) query.set("page", "1");
    if (!query.has("order_by")) query.set("order_by", "pdate_to_down");

    const providerUrl = `https://api.lzt.market/${categoryPath[category]}?${query.toString()}`;
    const provider = await fetch(providerUrl, { headers });

    if (!provider.ok) {
      return json({ error: "Provider request failed", status: provider.status }, 502);
    }

    const raw = objectValue(await provider.json());
    const rawItems = Array.isArray(raw.items)
      ? raw.items
      : raw.items && typeof raw.items === "object"
        ? Object.values(raw.items as RecordValue)
        : [];

    const items = rawItems.map((item) => publicItem(item, category));
    const currentPage = Number(raw.currentPage ?? raw.current_page ?? 1) || 1;
    const totalPages = Number(raw.totalPages ?? raw.total_pages ?? currentPage) || currentPage;
    const totalItems = Number(raw.totalItems ?? raw.total_items ?? raw.total ?? items.length) || items.length;

    const body: RecordValue = {
      items,
      currentPage,
      totalPages,
      totalItems,
      hasNextPage: typeof raw.hasNextPage === "boolean" ? raw.hasNextPage : currentPage < totalPages,
      source: "lzt",
      category,
      preview: true,
    };

    if (url.searchParams.get("schema") === "1") {
      body.providerFieldNames = rawItems.length ? sanitizedFields(objectValue(rawItems[0])) : [];
    }

    return json(body);
  } catch {
    return json({ error: "Preview provider request failed" }, 502);
  }
});
