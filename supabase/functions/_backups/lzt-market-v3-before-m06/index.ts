import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const token = Deno.env.get("LZT_MARKET_TOKEN");
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
