import { createClient } from "https://esm.sh/@supabase/supabase-js@2.109.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.default) return String(parsed.default);
    } catch {}
  }
  return Deno.env.get("SUPABASE_SECRET_KEY")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || "";
}

async function getCaller(req: Request, admin: any) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const { data, error } = await admin.auth.getUser(authHeader.slice(7));
  if (error || !data.user) return null;
  return data.user;
}

function isBlockedEntitlement(status: string | null | undefined) {
  return status === "revoked" || status === "refunded" || status === "disputed";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = secretKey();
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "LIBRARY_BACKEND_NOT_CONFIGURED" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const caller = await getCaller(req, admin);
  if (!caller) return json({ error: "UNAUTHORIZED" }, 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("banned")
    .eq("user_id", caller.id)
    .maybeSingle();

  if (profile?.banned) return json({ error: "ACCOUNT_BANNED" }, 403);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "snapshot";

  if (action === "snapshot" && req.method === "GET") {
    const { data: deliveries, error: deliveryError } = await admin
      .from("library_deliveries")
      .select("id,delivery_type,product_id,product_plan_id,entitlement_id,status,delivered_at,expires_at,reveal_count,last_revealed_at,metadata")
      .eq("user_id", caller.id)
      .order("delivered_at", { ascending: false })
      .limit(200);

    if (deliveryError) return json({ error: "LIBRARY_SNAPSHOT_FAILED" }, 500);

    const rows = deliveries || [];
    const productIds = [...new Set(rows.map((item: any) => item.product_id).filter(Boolean))];
    const planIds = [...new Set(rows.map((item: any) => item.product_plan_id).filter(Boolean))];
    const entitlementIds = [...new Set(rows.map((item: any) => item.entitlement_id).filter(Boolean))];

    const [
      { data: products },
      { data: plans },
      { data: entitlements },
      { data: roleGrants },
      { data: events },
    ] = await Promise.all([
      productIds.length
        ? admin.from("products")
            .select("id,name,image_url,status,status_label,tutorial_text,tutorial_file_url")
            .in("id", productIds)
        : Promise.resolve({ data: [] }),
      planIds.length
        ? admin.from("product_plans")
            .select("id,name,plan_code")
            .in("id", planIds)
        : Promise.resolve({ data: [] }),
      entitlementIds.length
        ? admin.from("entitlements")
            .select("id,status,tutorial_access")
            .eq("user_id", caller.id)
            .in("id", entitlementIds)
        : Promise.resolve({ data: [] }),
      entitlementIds.length
        ? admin.from("discord_role_grants")
            .select("id,entitlement_id,role_name,status,granted_at,revoked_at")
            .eq("user_id", caller.id)
            .in("entitlement_id", entitlementIds)
        : Promise.resolve({ data: [] }),
      admin.from("library_reveal_events")
        .select("id,delivery_id,action,created_at")
        .eq("user_id", caller.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const productMap = new Map((products || []).map((item: any) => [item.id, item]));
    const planMap = new Map((plans || []).map((item: any) => [item.id, item]));
    const entitlementMap = new Map((entitlements || []).map((item: any) => [item.id, item]));
    const roleMap = new Map<string, any[]>();

    for (const grant of roleGrants || []) {
      const current = roleMap.get(grant.entitlement_id) || [];
      current.push(grant);
      roleMap.set(grant.entitlement_id, current);
    }

    const now = Date.now();
    const safeDeliveries = rows.map((item: any) => {
      const product = productMap.get(item.product_id) || null;
      const plan = planMap.get(item.product_plan_id) || null;
      const entitlement = item.entitlement_id
        ? entitlementMap.get(item.entitlement_id) || null
        : null;
      const expired = Boolean(
        item.expires_at && new Date(item.expires_at).getTime() <= now
      );
      const effectiveStatus = item.status === "available" && expired
        ? "expired"
        : item.status;
      const entitlementBlocked = isBlockedEntitlement(entitlement?.status);

      return {
        id: item.id,
        deliveryType: item.delivery_type,
        status: effectiveStatus,
        deliveredAt: item.delivered_at,
        expiresAt: item.expires_at,
        revealCount: item.reveal_count || 0,
        lastRevealedAt: item.last_revealed_at,
        canReveal: effectiveStatus === "available" && !entitlementBlocked,
        product: {
          id: item.product_id,
          name: product?.name || "Entrega CRAZZY",
          imageUrl: product?.image_url || null,
          status: product?.status || null,
          statusLabel: product?.status_label || null,
        },
        plan: {
          id: item.product_plan_id,
          name: plan?.name || null,
          code: plan?.plan_code || null,
        },
        entitlement: entitlement
          ? {
              id: entitlement.id,
              status: entitlement.status,
              tutorialAccess: Boolean(entitlement.tutorial_access),
            }
          : null,
        tutorialAvailable: Boolean(
          entitlement?.tutorial_access
          && (product?.tutorial_text || product?.tutorial_file_url)
        ),
        discordRoles: item.entitlement_id
          ? roleMap.get(item.entitlement_id) || []
          : [],
        metadata: item.metadata || {},
      };
    });

    const deliveryMap = new Map(safeDeliveries.map((item: any) => [item.id, item]));
    const history = (events || []).map((event: any) => ({
      id: event.id,
      deliveryId: event.delivery_id,
      action: event.action,
      createdAt: event.created_at,
      productName: deliveryMap.get(event.delivery_id)?.product?.name || "Entrega CRAZZY",
      deliveryType: deliveryMap.get(event.delivery_id)?.deliveryType || "manual",
    }));

    return json({
      deliveries: safeDeliveries,
      history,
      stats: {
        total: safeDeliveries.length,
        available: safeDeliveries.filter((item: any) => item.canReveal).length,
        keys: safeDeliveries.filter((item: any) => item.deliveryType === "key").length,
        accounts: safeDeliveries.filter((item: any) => item.deliveryType === "account").length,
        rewards: safeDeliveries.filter((item: any) => item.deliveryType === "reward").length,
      },
    });
  }

  if (action === "reveal" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const deliveryId = String(body?.delivery_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(deliveryId)) {
      return json({ error: "INVALID_DELIVERY" }, 400);
    }

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("library_reveal_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", caller.id)
      .eq("action", "reveal")
      .gte("created_at", since);

    if ((count || 0) >= 30) {
      return json({ error: "REVEAL_RATE_LIMIT" }, 429);
    }

    const { data, error } = await admin.rpc("library_reveal_owned_delivery", {
      p_delivery_id: deliveryId,
      p_user_id: caller.id,
    });

    if (error) {
      console.error("[library] reveal rpc failed", error.code || "unknown");
      return json({ error: "REVEAL_FAILED" }, 500);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.payload) {
      return json({ error: "DELIVERY_NOT_AVAILABLE" }, 404);
    }

    return json({
      deliveryId,
      payload: row.payload,
      payloadFormat: row.payload_format,
      deliveryType: row.delivery_type,
    });
  }

  if (action === "copy-event" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const deliveryId = String(body?.delivery_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(deliveryId)) {
      return json({ error: "INVALID_DELIVERY" }, 400);
    }

    const { data, error } = await admin.rpc("library_record_copy_event", {
      p_delivery_id: deliveryId,
      p_user_id: caller.id,
    });

    if (error) {
      console.error("[library] copy audit failed", error.code || "unknown");
      return json({ error: "COPY_AUDIT_FAILED" }, 500);
    }

    if (data !== true) return json({ error: "DELIVERY_NOT_AVAILABLE" }, 404);
    return json({ success: true });
  }

  return json({ error: "NOT_FOUND" }, 404);
});
