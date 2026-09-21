import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


type CosmeticAsset = {
  name: string;
  category: string | null;
  rarity: string | null;
  imageUrl: string | null;
};

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function pickText(source: any, keys: string[]): string | null {
  if (!source || typeof source !== "object") return null;
  for (const key of keys) {
    const value = textValue(source[key]);
    if (value) return value;
  }
  return null;
}

function asEntries(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return value == null ? [] : [value];
}

function cosmeticAssets(item: any): CosmeticAsset[] {
  const groups: Array<[string, string]> = [
    ["valorant_skins", "Skin"],
    ["weaponSkins", "Skin"],
    ["weapon_skins", "Skin"],
    ["skins", "Skin"],
    ["fortnite_skins", "Skin"],
    ["lol_skins", "Skin"],
    ["valorant_knives", "Faca"],
    ["knives", "Faca"],
    ["capes", "Capa"],
    ["inventory", "Inventário"],
    ["inventory_items", "Inventário"],
  ];

  const assets: CosmeticAsset[] = [];
  const seen = new Set<string>();

  for (const [key, category] of groups) {
    for (const raw of asEntries(item?.[key])) {
      const source = raw && typeof raw === "object" ? raw : { name: raw };
      const name =
        pickText(source, ["displayName", "display_name", "name", "title", "skin_name", "item_name"]) ||
        textValue(raw) ||
        category;
      const rarity = pickText(source, ["rarity", "tier", "rarity_name", "quality"]);
      const imageUrl = pickText(source, [
        "displayIcon", "display_icon", "image", "image_url", "icon", "icon_url",
        "thumbnail", "thumbnail_url", "splash", "splash_url", "picture", "picture_url",
      ]);
      const signature = category + "|" + name + "|" + (imageUrl || "");
      if (seen.has(signature)) continue;
      seen.add(signature);
      assets.push({ name: name.slice(0, 120), category, rarity, imageUrl });
      if (assets.length >= 24) return assets;
    }
  }

  return assets;
}

function safeStringList(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => typeof entry === "string" || typeof entry === "number" ? String(entry) : "")
      .filter(Boolean)
      .slice(0, 250);
  }
  if (value && typeof value === "object") {
    return Object.values(value)
      .map((entry) => typeof entry === "string" || typeof entry === "number" ? String(entry) : "")
      .filter(Boolean)
      .slice(0, 250);
  }
  return [];
}

function safeRemoteImageUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local")
    ) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    // Helper: authenticate user (returns null if not authenticated)
    const getAuthUser = async () => {
      if (!authHeader?.startsWith("Bearer ")) return null;
      const supabaseUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await supabaseUser.auth.getUser();
      return error ? null : user;
    };

    let token =
      Deno.env.get("LZT_MARKET_TOKEN") ||
      Deno.env.get("LZT_API_TOKEN") ||
      "";

    // M06: secure fallback for migrated projects where the legacy token lives
    // in the admin-only system_credentials table instead of Edge Secrets.
    if (!token) {
      let adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!adminKey) {
        try {
          const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
          adminKey = secretKeys?.default || "";
        } catch {
          adminKey = "";
        }
      }

      if (adminKey) {
        const supabaseAdmin = createClient(supabaseUrl, adminKey);
        const { data: credentialRows } = await supabaseAdmin
          .from("system_credentials")
          .select("env_key, value")
          .in("env_key", ["LZT_API_TOKEN", "LZT_MARKET_TOKEN"]);

        const byKey = new Map(
          (credentialRows || []).map((row: any) => [row.env_key, String(row.value || "").trim()])
        );
        token =
          byKey.get("LZT_API_TOKEN") ||
          byKey.get("LZT_MARKET_TOKEN") ||
          "";
      }
    }

    if (!token) {
      return new Response(JSON.stringify({ error: "LZT token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";
    const itemId = url.searchParams.get("item_id");

    // DIAGNOSTIC: admin-only health check. Never return token fragments or raw provider
    // bodies because provider responses may contain account data.
    if (action === "test") {
      const user = await getAuthUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const { data: adminRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const testUrl = "https://api.lzt.market/riot?pmax=100&currency=rub&page=1";
        const testRes = await fetch(testUrl, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        const testText = await testRes.text();
        let parsed: any = null;
        try { parsed = JSON.parse(testText); } catch {}
        console.log("[lzt-market] provider health check", { status: testRes.status });
        return new Response(JSON.stringify({
          ok: testRes.ok,
          status: testRes.status,
          itemsCount: parsed?.items ? (Array.isArray(parsed.items) ? parsed.items.length : Object.keys(parsed.items).length) : 0,
          totalItems: parsed?.totalItems ?? null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Provider health check failed" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // IMAGE PROXY: Proxy image requests to bypass CORS
    if (action === "image-proxy") {
      // SECURITY: Require auth for image proxy
      const user = await getAuthUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const imageUrl = url.searchParams.get("url");
      if (!imageUrl) {
        return new Response(JSON.stringify({ error: "url parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // SECURITY: Only allow proxying from known LZT domains
      try {
        const parsedUrl = new URL(imageUrl);
        const hostname = parsedUrl.hostname.toLowerCase();
        const allowedHost = hostname === "lzt.market" || hostname.endsWith(".lzt.market");
        if (parsedUrl.protocol !== "https:" || !allowedHost) {
          return new Response(JSON.stringify({ error: "Domain not allowed" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: "Invalid URL" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch(imageUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "image/*",
        },
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Image fetch failed", status: response.status }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const imageData = await response.arrayBuffer();
      const contentType = response.headers.get("Content-Type") || "image/png";

      return new Response(imageData, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // FAST-BUY: Purchase an account - ADMIN ONLY
    if (action === "fast-buy" && req.method === "POST") {
      // SECURITY: Require auth + admin only
      const user = await getAuthUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const { data: adminRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { item_id, price, currency } = body;

      if (!item_id || !price) {
        return new Response(JSON.stringify({ error: "item_id and price required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const buyUrl = `https://api.lzt.market/${encodeURIComponent(item_id)}/fast-buy?price=${encodeURIComponent(price)}${currency ? `&currency=${encodeURIComponent(currency)}` : ""}`;
      console.log("Fast-buy:", buyUrl);

      const response = await fetch(buyUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const data = await response.json();
      console.log("Fast-buy response", { status: response.status, itemId: String(item_id) });

      if (!response.ok) {
        console.warn("[lzt-market] fast-buy failed", { status: response.status, itemId: String(item_id) });
        return new Response(
          JSON.stringify({ error: "Provider purchase failed", status: response.status }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CRAZZY account media proxy. The browser receives only CRAZZY URLs.
    if (action === "preview-media-v2") {
      if (req.method !== "GET") {
        return new Response(null, { status: 405, headers: corsHeaders });
      }

      const previewItemId = url.searchParams.get("item_id") || "";
      const mediaIndex = Number(url.searchParams.get("index") || "0");
      if (!/^\d{1,30}$/.test(previewItemId) || !Number.isInteger(mediaIndex) || mediaIndex < 0 || mediaIndex > 23) {
        return new Response(null, { status: 404, headers: corsHeaders });
      }

      const providerResponse = await fetch(
        `https://api.lzt.market/${encodeURIComponent(previewItemId)}?currency=brl`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      );
      if (!providerResponse.ok) {
        return new Response(null, { status: 404, headers: corsHeaders });
      }

      const providerData = await providerResponse.json().catch(() => null);
      const providerItem = providerData?.item ?? providerData;
      const asset = cosmeticAssets(providerItem)[mediaIndex];
      const assetUrl = safeRemoteImageUrl(asset?.imageUrl || null);
      if (!assetUrl) return new Response(null, { status: 404, headers: corsHeaders });

      const imageResponse = await fetch(assetUrl, {
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*" },
      });
      if (!imageResponse.ok) return new Response(null, { status: 404, headers: corsHeaders });

      const imageData = await imageResponse.arrayBuffer();
      return new Response(imageData, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": imageResponse.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // M06 PREVIEW DETAIL V2: isolated, GET-only and sanitized.
    if (action === "preview-detail-v2") {
      if (req.method !== "GET") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const previewItemId = url.searchParams.get("item_id") || "";
      if (!/^\d{1,30}$/.test(previewItemId)) {
        return new Response(JSON.stringify({ error: "Invalid item id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const requestedGame = url.searchParams.get("game") || "unknown";
      const allowedGames = new Set(["valorant", "lol", "fortnite", "minecraft"]);
      const safeGame = allowedGames.has(requestedGame) ? requestedGame : "unknown";

      const providerResponse = await fetch(
        `https://api.lzt.market/${encodeURIComponent(previewItemId)}?currency=brl`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!providerResponse.ok) {
        return new Response(
          JSON.stringify({
            error: "Provider request failed",
            status: providerResponse.status,
          }),
          {
            status: providerResponse.status === 404 ? 404 : 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const providerText = await providerResponse.text();
      let item: any;
      try {
        const parsedItem = JSON.parse(providerText);
        item = parsedItem?.item ?? parsedItem;
      } catch {
        return new Response(JSON.stringify({ error: "Provider returned invalid JSON" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const first = (keys: string[]) => {
        for (const key of keys) {
          const value = item?.[key];
          if (value !== undefined && value !== null && value !== "") return value;
        }
        return null;
      };

      const safeCount = (value: any): number | null => {
        if (Array.isArray(value)) return value.length;
        if (value && typeof value === "object") return Object.keys(value).length;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
      };

      let serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!serviceRoleKey) {
        try {
          const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
          serviceRoleKey = secretKeys?.default || "";
        } catch {
          serviceRoleKey = "";
        }
      }

      let markup = 1.5;
      if (serviceRoleKey) {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
        const { data: config } = await supabaseAdmin
          .from("lzt_config")
          .select("markup_multiplier, markup_valorant, markup_lol, markup_fortnite, markup_minecraft")
          .limit(1)
          .maybeSingle();
        const selected =
          safeGame === "valorant" ? config?.markup_valorant :
          safeGame === "lol" ? config?.markup_lol :
          safeGame === "fortnite" ? config?.markup_fortnite :
          safeGame === "minecraft" ? config?.markup_minecraft :
          config?.markup_multiplier;
        const parsedMarkup = Number(selected ?? config?.markup_multiplier ?? 1.5);
        if (Number.isFinite(parsedMarkup) && parsedMarkup > 0) markup = parsedMarkup;
      }

      const basePrice = Number(first(["price", "price_value", "item_price"]) || 0);
      const commercialPrice =
        Number.isFinite(basePrice) && basePrice > 0
          ? Math.round(basePrice * markup * 100) / 100
          : null;
      const publicCosmetics = cosmeticAssets(item).map((asset, index) => ({
        name: asset.name,
        category: asset.category,
        rarity: asset.rarity,
        mediaIndex: asset.imageUrl ? index : null,
      }));

      const safeItem = {
        id: String(first(["item_id", "itemId", "id"]) ?? previewItemId),
        title: String(first(["title", "title_en", "name"]) ?? `Conta #${previewItemId}`),
        game: safeGame,
        price: commercialPrice,
        cosmetics: publicCosmetics,
        region: first([
          "riot_valorant_region", "valorantRegionPhrase", "valorant_region",
          "riot_lol_region", "lol_region", "region", "fortnite_region", "country",
        ]),
        rank: first([
          "riot_lol_rank", "lol_rank", "valorant_rank_name", "rank_name", "rank",
        ]),
        rankValue: first(["riot_valorant_rank", "valorant_rank", "rank_value", "rank"]),
        level: first([
          "riot_valorant_level", "riot_lol_level", "valorant_level", "lol_level",
          "fortnite_level", "minecraft_hypixel_level", "hypixel_level", "level",
        ]),
        skinsCount: safeCount(first([
          "riot_valorant_skin_count", "riot_lol_skin_count", "fortnite_skin_count",
          "valorant_skins", "weaponSkins", "weapon_skins", "skins", "skin_count", "skins_count",
        ])),
        knivesCount: safeCount(first([
          "riot_valorant_knife_count", "riot_valorant_knife",
          "valorant_knives", "knives", "knife_count", "valorant_knife_count",
        ])),
        agentsCount: safeCount(first([
          "riot_valorant_agent_count", "agents", "valorant_agents", "agent_count", "agents_count",
        ])),
        championsCount: safeCount(first([
          "riot_lol_champion_count", "champions", "champion_count", "champions_count",
        ])),
        inventoryValue: first(["riot_valorant_inventory_value", "inventory_value", "inv", "inventoryValue"]),
        vp: first(["riot_valorant_wallet_vp", "vp", "valorant_points", "valorant_vp"]),
        rp: first(["riot_valorant_wallet_rp", "rp", "radiant_points", "valorant_rp"]),
        emailType: first(["email_type", "emailType"]),
        country: first(["riot_country", "country", "country_name"]),
        vbucks: first(["fortnite_vbucks", "vbucks", "v_bucks"]),
        minecoins: first(["minecraft_minecoins", "minecoins"]),
        capesCount: safeCount(first(["minecraft_capes_count", "capes", "cape_count", "capes_count"])),
        java: first(["minecraft_java", "java"]),
        bedrock: first(["minecraft_bedrock", "bedrock"]),
        dungeons: first(["minecraft_dungeons", "dungeons"]),
        legends: first(["minecraft_legends", "legends"]),
        skinIds: safeStringList(item?.valorantInventory?.WeaponSkins),
      };

      return new Response(JSON.stringify({ item: safeItem }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    // M06 PREVIEW V2: isolated, read-only multigame listing.
    // Existing list/detail/fast-buy/test behavior below remains unchanged.
    if (action === "preview-v2") {
      if (req.method !== "GET") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const category = url.searchParams.get("category") || "riot";
      const categoryMap: Record<string, string> = {
        riot: "riot",
        fortnite: "fortnite",
        minecraft: "minecraft",
      };
      const categoryPath = categoryMap[category];
      if (!categoryPath) {
        return new Response(JSON.stringify({ error: "Unsupported category" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
      const fortniteArrays = [
        "skin[]", "pickaxe[]", "glider[]", "dance[]", "platform[]",
      ];

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

      const params = new URLSearchParams();

      const appendScalar = (keys: string[]) => {
        for (const key of keys) {
          const value = url.searchParams.get(key);
          if (value != null && value !== "") params.set(key, value);
        }
      };
      const appendArrays = (keys: string[]) => {
        for (const key of keys) {
          for (const value of url.searchParams.getAll(key)) {
            if (value) params.append(key, value);
          }
        }
      };

      appendScalar(commonScalar);
      appendArrays(commonArrays);

      if (category === "riot") {
        appendScalar(riotScalar);
        appendArrays(riotArrays);
        const game = url.searchParams.get("game");
        if (game === "valorant") params.append("riot_game[]", "valorant");
        if (game === "lol") params.append("riot_game[]", "league-of-legends");
      } else if (category === "fortnite") {
        appendScalar(fortniteScalar);
        appendArrays(fortniteArrays);
      } else if (category === "minecraft") {
        appendScalar(minecraftScalar);
        appendArrays(minecraftArrays);
      }

      let serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!serviceRoleKey) {
        try {
          const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
          serviceRoleKey = secretKeys?.default || "";
        } catch {
          serviceRoleKey = "";
        }
      }

      if (!serviceRoleKey) {
        return new Response(JSON.stringify({ error: "Backend secret key unavailable" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const { data: lztConfig } = await supabaseAdmin
        .from("lzt_config")
        .select("max_fetch_price, currency, markup_multiplier, markup_valorant, markup_lol, markup_fortnite, markup_minecraft")
        .limit(1)
        .maybeSingle();

      const maxFetchPrice = lztConfig?.max_fetch_price != null
        ? Number(lztConfig.max_fetch_price)
        : 500;
      const clientPmax = Number(url.searchParams.get("pmax") || maxFetchPrice);
      const effectivePmax = Math.min(
        Number.isFinite(clientPmax) && clientPmax > 0 ? clientPmax : maxFetchPrice,
        maxFetchPrice
      );

      const supportedCurrencies = new Set([
        "rub", "uah", "kzt", "byn", "usd", "eur", "gbp", "cny", "try", "jpy", "brl",
      ]);
      const configuredCurrency = String(lztConfig?.currency || "BRL").toLowerCase();
      const providerCurrency = supportedCurrencies.has(configuredCurrency)
        ? configuredCurrency
        : "brl";

      params.set("pmax", String(Math.round(effectivePmax)));
      params.set("currency", providerCurrency);
      if (!params.has("page")) params.set("page", "1");
      if (!params.has("order_by")) params.set("order_by", "pdate_to_down");

      const { data: waitMsRaw, error: slotError } = await supabaseAdmin
        .rpc("reserve_lzt_search_slot", { _spacing_ms: 3100 });

      if (slotError) {
        console.error("[lzt-market] rate slot failed");
        return new Response(JSON.stringify({ error: "Search throttle unavailable" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const waitMs = Math.max(0, Number(waitMsRaw || 0));
      if (waitMs > 15000) {
        return new Response(JSON.stringify({
          error: "Search queue busy",
          retry_after_ms: waitMs,
        }), {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil(waitMs / 1000)),
          },
        });
      }

      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      const providerUrl = `https://api.lzt.market/${categoryPath}?${params.toString()}`;
      const providerResponse = await fetch(providerUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!providerResponse.ok) {
        console.warn("[lzt-market] preview-v2 provider request failed", {
          category,
          status: providerResponse.status,
        });
        return new Response(
          JSON.stringify({ error: "Provider request failed", status: providerResponse.status }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const providerText = await providerResponse.text();
      let providerData: any;
      try {
        providerData = JSON.parse(providerText);
      } catch {
        return new Response(JSON.stringify({ error: "Provider returned invalid JSON" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rawItems = Array.isArray(providerData?.items)
        ? providerData.items
        : providerData?.items && typeof providerData.items === "object"
          ? Object.values(providerData.items)
          : [];

      const sensitiveKeyPattern =
        /(password|passwd|cookie|token|secret|credential|login_data|auth_data|email_pass|mail_pass|refresh|access_token|account_data)/i;

      const safeCount = (value: any): number | null => {
        if (Array.isArray(value)) return value.length;
        if (value && typeof value === "object") return Object.keys(value).length;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
      };

      const first = (item: any, keys: string[]) => {
        for (const key of keys) {
          const value = item?.[key];
          if (value !== undefined && value !== null && value !== "") return value;
        }
        return null;
      };

      const safeItems = rawItems.map((item: any) => ({
        id: String(first(item, ["item_id", "itemId", "id"]) ?? ""),
        title: String(first(item, ["title", "title_en", "name"]) ?? ""),
        category,
        region: first(item, [
          "riot_valorant_region", "valorantRegionPhrase", "valorant_region",
          "riot_lol_region", "lol_region", "region", "fortnite_region", "country",
        ]),
        rank: first(item, [
          "riot_lol_rank", "lol_rank", "valorant_rank_name", "rank", "rank_name",
        ]),
        rankValue: first(item, ["riot_valorant_rank", "valorant_rank", "rank_value", "rank"]),
        level: first(item, [
          "riot_valorant_level", "riot_lol_level", "valorant_level", "lol_level",
          "fortnite_level", "minecraft_hypixel_level", "hypixel_level", "level",
        ]),
        skinsCount: safeCount(first(item, [
          "riot_valorant_skin_count", "riot_lol_skin_count", "fortnite_skin_count",
          "valorant_skins", "weaponSkins", "weapon_skins", "skins", "skin_count", "skins_count",
        ])),
        knivesCount: safeCount(first(item, [
          "riot_valorant_knife_count", "riot_valorant_knife",
          "valorant_knives", "knives", "knife_count", "valorant_knife_count",
        ])),
        agentsCount: safeCount(first(item, [
          "riot_valorant_agent_count", "agents", "valorant_agents", "agent_count", "agents_count",
        ])),
        championsCount: safeCount(first(item, [
          "riot_lol_champion_count", "champions", "champion_count", "champions_count",
        ])),
        inventoryValue: first(item, ["riot_valorant_inventory_value", "inventory_value", "inv", "inventoryValue"]),
        vp: first(item, ["riot_valorant_wallet_vp", "vp", "valorant_points", "valorant_vp"]),
        rp: first(item, ["riot_valorant_wallet_rp", "rp", "radiant_points", "valorant_rp"]),
        country: first(item, ["riot_country", "country", "country_name"]),
        vbucks: first(item, ["fortnite_vbucks", "vbucks", "v_bucks"]),
        minecoins: first(item, ["minecraft_minecoins", "minecoins"]),
        capesCount: safeCount(first(item, ["minecraft_capes_count", "capes", "cape_count", "capes_count"])),
        java: first(item, ["minecraft_java", "java"]),
        bedrock: first(item, ["minecraft_bedrock", "bedrock"]),
        dungeons: first(item, ["minecraft_dungeons", "dungeons"]),
        legends: first(item, ["minecraft_legends", "legends"]),
        skinIds: safeStringList(item?.valorantInventory?.WeaponSkins),
        price: (() => {
          const base = Number(first(item, ["price", "price_value", "item_price"]) || 0);
          const game = url.searchParams.get("game") || "";
          const selected =
            game === "valorant" ? lztConfig?.markup_valorant :
            game === "lol" ? lztConfig?.markup_lol :
            game === "fortnite" ? lztConfig?.markup_fortnite :
            game === "minecraft" ? lztConfig?.markup_minecraft :
            lztConfig?.markup_multiplier;
          const multiplier = Number(selected ?? lztConfig?.markup_multiplier ?? 1.5);
          return Number.isFinite(base) && base > 0 && Number.isFinite(multiplier) && multiplier > 0
            ? Math.round(base * multiplier * 100) / 100
            : null;
        })(),
        cosmetics: cosmeticAssets(item).slice(0, 4).map((asset) => ({
          name: asset.name,
          category: asset.category,
          rarity: asset.rarity,
          mediaIndex: null,
        })),
      }));

      const currentPage = Number(providerData?.currentPage ?? providerData?.current_page ?? 1) || 1;
      const totalPages = Number(providerData?.totalPages ?? providerData?.total_pages ?? currentPage) || currentPage;
      const totalItems = Number(providerData?.totalItems ?? providerData?.total_items ?? providerData?.total ?? safeItems.length) || safeItems.length;

      const responseBody: any = {
        items: safeItems,
        currentPage,
        totalPages,
        totalItems,
        hasNextPage:
          typeof providerData?.hasNextPage === "boolean"
            ? providerData.hasNextPage
            : currentPage < totalPages,
        game: url.searchParams.get("game") || category,
      };

      if (url.searchParams.get("schema") === "1") {
        const sample = rawItems[0] && typeof rawItems[0] === "object" ? rawItems[0] : {};
        responseBody.providerFieldNames = Object.keys(sample)
          .filter((key) => !sensitiveKeyPattern.test(key))
          .sort()
          .slice(0, 180);
      }

      return new Response(JSON.stringify(responseBody), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    // DETAIL: Get single item
    let apiUrl: string;
    if (action === "detail" && itemId) {
      apiUrl = `https://api.lzt.market/${encodeURIComponent(itemId)}`;
    } else {
      // LIST: accounts with filters
      const params = new URLSearchParams();
      const allowedParams = [
        "page", "pmin", "pmax", "title", "order_by", "currency",
        "rmin", "rmax", "last_rmin", "last_rmax", "previous_rmin", "previous_rmax",
        "valorant_level_min", "valorant_level_max",
        "valorant_smin", "valorant_smax",
        "valorant_knife_min", "valorant_knife_max",
        "vp_min", "vp_max", "rp_min", "rp_max",
        "fa_min", "fa_max",
        "inv_min", "inv_max",
        "knife", "nsb",
        "amin", "amax",
      ];

      for (const p of allowedParams) {
        const val = url.searchParams.get(p);
        if (val) params.set(p, val);
      }

      // Aplicar limite de preço máximo (lzt_config.max_fetch_price) — busca contas até X valor
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const { data: lztConfig } = await supabaseAdmin
        .from("lzt_config")
        .select("max_fetch_price")
        .limit(1)
        .maybeSingle();

      const maxFetchPrice = lztConfig?.max_fetch_price != null ? Number(lztConfig.max_fetch_price) : 500;
      const clientPmax = url.searchParams.get("pmax");
      const effectivePmax = clientPmax != null
        ? Math.min(Number(clientPmax) || maxFetchPrice, maxFetchPrice)
        : maxFetchPrice;
      params.set("pmax", String(Math.round(effectivePmax)));
      if (!params.has("currency")) params.set("currency", "rub");

      const arrayParams = [
        "weaponSkin[]", "buddy[]", "agent[]", "valorant_region[]",
        "valorant_rank_type[]", "email_type[]", "country[]",
      ];
      for (const p of arrayParams) {
        const vals = url.searchParams.getAll(p);
        for (const v of vals) {
          params.append(p, v);
        }
      }

      apiUrl = `https://api.lzt.market/riot?${params.toString()}`;
    }

    console.log("Fetching:", apiUrl);

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn("[lzt-market] provider request failed", { status: response.status, action });
      return new Response(
        JSON.stringify({ error: "Provider request failed", status: response.status }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.warn("[lzt-market] provider returned non-JSON", { action });
      return new Response(JSON.stringify({ error: "Provider returned an invalid response" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LZT API returns items as object {id: item} — convert to array for frontend
    if (data?.items && !Array.isArray(data.items) && typeof data.items === "object") {
      data.items = Object.values(data.items);
      console.log("[lzt-market] Converted items object→array, count:", data.items.length);
    }

    // Ensure hasNextPage exists for frontend pagination
    if (data && typeof data.hasNextPage === "undefined") {
      const currentPg = data.currentPage ?? 1;
      const totalPg = data.totalPages ?? 1;
      data.hasNextPage = currentPg < totalPg;
    }

    console.log("[lzt-market] OK: items=", data?.items?.length ?? 0, "totalItems=", data?.totalItems ?? "?", "hasNextPage=", data?.hasNextPage);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
