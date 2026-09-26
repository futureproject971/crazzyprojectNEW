import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const PLAN_CODES = new Set([
  "trial",
  "1d",
  "3d",
  "7d",
  "15d",
  "30d",
  "90d",
  "lifetime",
  "single",
  "custom",
]);
const DELIVERY_MODES = new Set([
  "internal_stock",
  "ghost_stock",
  "purincash_supplier",
  "lzt_account",
  "manual",
  "service",
]);

function cleanString(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function nullableString(value: unknown, max = 500) {
  const normalized = cleanString(value, max);
  return normalized || null;
}

function safeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function safePrice(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) return null;
  return Math.round(parsed * 100) / 100;
}

function safeColor(value: unknown) {
  const normalized = nullableString(value, 7);
  if (!normalized) return null;
  return COLOR_RE.test(normalized) ? normalized.toUpperCase() : null;
}

function safeAssetUrl(value: unknown) {
  const normalized = nullableString(value, 1200);
  if (!normalized) return null;
  if ((normalized.startsWith("/") && !normalized.startsWith("//")) || normalized.startsWith("https://")) return normalized;
  return null;
}

function safeTutorialIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter((item) => UUID_RE.test(item)))].slice(0, 200);
}

function safeMedia(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 24).map((raw, index) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const type = cleanString(item.media_type || item.type || "image", 20).toLowerCase();
    const url = safeAssetUrl(item.url);
    if (!url || !["image","video","youtube","streamable"].includes(type)) return null;
    return { media_type: type, url, sort_order: safeInteger(item.sort_order, index) };
  }).filter(Boolean) as Array<{media_type:string;url:string;sort_order:number}>;
}

function safeFeatures(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).map((raw, index) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const label = cleanString(item.label, 80);
    const featureValue = cleanString(item.value, 240);
    if (!label || !featureValue) return null;
    return { label, value: featureValue, sort_order: safeInteger(item.sort_order, index) };
  }).filter(Boolean) as Array<{label:string;value:string;sort_order:number}>;
}

async function syncProductExtras(supabase: any, productId: string, mediaInput: unknown, featuresInput: unknown) {
  const {error} = await supabase.rpc("admin_sync_product_extras", {
    p_product_id: productId,
    p_media: Array.isArray(mediaInput) ? safeMedia(mediaInput) : null,
    p_features: Array.isArray(featuresInput) ? safeFeatures(featuresInput) : null,
  });
  if(error) throw new Error("PRODUCT_EXTRAS_SYNC_FAILED");
}

function safeAutomationFlags(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const result: Record<string, unknown> = Object.fromEntries(
    ["auto_delivery", "auto_discord_role", "auto_tutorial_unlock", "auto_expire"]
      .map((key) => [key, input[key] === true])
  );

  for (const [key, max] of [
    ["supplier_store_product_id", 200],
    ["supplier_display_name", 160],
    ["supplier_variation_name", 160],
    ["supplier_last_synced_at", 64],
  ] as const) {
    const cleaned = nullableString(input[key], max);
    if (cleaned) result[key] = cleaned;
  }

  const syncStatus = cleanString(input.supplier_sync_status, 32);
  if (["synced", "stale", "needs_review", "unavailable"].includes(syncStatus)) {
    result.supplier_sync_status = syncStatus;
  }

  for (const key of ["supplier_variation_index", "supplier_catalog_price_cents", "supplier_stock"] as const) {
    if (input[key] === null || input[key] === undefined || input[key] === "") continue;
    const parsed = Number(input[key]);
    if (Number.isInteger(parsed) && parsed >= 0) result[key] = parsed;
  }
  result.supplier_unlimited = input.supplier_unlimited === true;

  return result;
}

async function adminClient() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: isAdmin, error } = await supabase.rpc("is_current_admin");

  return {
    supabase,
    user,
    isAdmin: !error && isAdmin === true,
  };
}

function adminGuard(user: unknown, isAdmin: boolean) {
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return null;
}

export async function GET() {
  const { supabase, user, isAdmin } = await adminClient();
  const denied = adminGuard(user, isAdmin);
  if (denied) return denied;

  const { data, error } = await supabase.rpc("get_product_manager_catalog");
  if (error || !data) {
    return NextResponse.json({ error: "PRODUCT_MANAGER_UNAVAILABLE" }, { status: 500 });
  }

  const catalog = data as any;
  const archived = await supabase.from("product_plans").select("id").not("archived_at", "is", null);
  if (archived.error) return NextResponse.json({error:"PRODUCT_MANAGER_UNAVAILABLE"},{status:500});
  const archivedIds = new Set((archived.data || []).map(row => row.id));
  catalog.products = (catalog.products || []).map((p:any) => ({...p, plans:(p.plans || []).filter((plan:any)=>!archivedIds.has(plan.id))}));
  const productIds = Array.isArray(catalog?.products) ? catalog.products.map((p:any)=>String(p.id||"")).filter((id:string)=>UUID_RE.test(id)) : [];
  const [mediaResult, featuresResult, roleResult] = productIds.length ? await Promise.all([
    supabase.from("product_media").select("id,product_id,media_type,url,sort_order").in("product_id",productIds).order("sort_order"),
    supabase.from("product_features").select("id,product_id,label,value,sort_order").in("product_id",productIds).order("sort_order"),
    supabase.from("products").select("id,discord_role_id,discord_role_name").in("id",productIds),
  ]) : [{data:[],error:null},{data:[],error:null},{data:[],error:null}];

  if (mediaResult.error || featuresResult.error || roleResult.error) {
    return NextResponse.json({ error: "PRODUCT_MANAGER_EXTRAS_UNAVAILABLE" }, { status: 500 });
  }

  const mediaByProduct = new Map<string, any[]>();
  for (const item of mediaResult.data || []) {
    const list = mediaByProduct.get(item.product_id) || [];
    list.push(item); mediaByProduct.set(item.product_id,list);
  }
  const featuresByProduct = new Map<string, any[]>();
  for (const item of featuresResult.data || []) {
    const list = featuresByProduct.get(item.product_id) || [];
    list.push(item); featuresByProduct.set(item.product_id,list);
  }
  catalog.products = (catalog.products || []).map((product:any)=>({
    ...product,
    ...(roleResult.data || []).find((row:any)=>row.id===product.id),
    media: mediaByProduct.get(product.id) || [],
    features: featuresByProduct.get(product.id) || [],
  }));

  return NextResponse.json(
    { catalog },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const { supabase, user, isAdmin } = await adminClient();
  const denied = adminGuard(user, isAdmin);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const action = cleanString(body?.action, 40);

  if (action === "reorder_plans" || action === "archive_plan") {
    const productId = cleanString(body.productId, 36);
    const planIds = Array.isArray(body.planIds) ? body.planIds.map(String) : [];
    if (!UUID_RE.test(productId) || (action === "reorder_plans" && (!planIds.length || planIds.some((id:string)=>!UUID_RE.test(id)))) || (action === "archive_plan" && !UUID_RE.test(String(body.planId)))) return NextResponse.json({error:"Planos inválidos."},{status:400});
    const {error} = await supabase.rpc(action === "reorder_plans" ? "admin_reorder_product_plans" : "admin_archive_product_plan", action === "reorder_plans" ? {p_product_id:productId,p_plan_ids:planIds} : {p_product_id:productId,p_plan_id:body.planId});
    if (error) return NextResponse.json({error:"Não foi possível atualizar os planos. Atualize a página e tente novamente."},{status:409});
    return NextResponse.json({saved:true});
  }

  if (action === "create_product") {
    const gameId = cleanString(body?.gameId, 36);
    const name = cleanString(body?.name, 120);
    if (!UUID_RE.test(gameId) || !name) {
      return NextResponse.json({ error: "INVALID_PRODUCT" }, { status: 400 });
    }

    const allowedPresets = new Set(["1d", "3d", "7d", "15d", "30d", "90d", "lifetime"]);
    const presetPlans = Array.isArray(body?.presetPlans)
      ? [...new Set(body.presetPlans.map((value: unknown) => cleanString(value, 20).toLowerCase()))]
          .filter((code) => allowedPresets.has(code))
      : [];
    if (body?.createDefaultPlans === true && presetPlans.length === 0) {
      presetPlans.push("1d", "3d", "7d", "15d", "30d", "90d", "lifetime");
    }
    const { data, error } = await supabase.rpc("create_product_manager_product", {
      p_game_id: gameId,
      p_name: name,
      p_emoji: nullableString(body?.emoji, 32),
      p_accent_color: safeColor(body?.accentColor),
      p_create_default_plans: false,
    });

    if (error || !data) {
      return NextResponse.json({ error: "PRODUCT_CREATE_FAILED" }, { status: 400 });
    }

    const createdId = cleanString((data as { id?: unknown })?.id, 36);
    if (UUID_RE.test(createdId)) {
      const { error: presentationError } = await supabase.rpc("save_product_manager_presentation", {
        p_product_id: createdId,
        p_description: nullableString(body?.description, 6000),
        p_icon_url: safeAssetUrl(body?.iconUrl),
        p_banner_url: safeAssetUrl(body?.bannerUrl),
        p_hide_delivery_badge: Boolean(body?.hideDeliveryBadge),
        p_auto_delivery: true,
      });

      if (presentationError) {
        return NextResponse.json(
          { error: "PRODUCT_PRESENTATION_SAVE_FAILED", created: data },
          { status: 400 }
        );
      }

      const status = cleanString(body?.status || "offline",40).toLowerCase();
      const statusMap: Record<string,string> = {online:"Online",offline:"Offline",updating:"Em atualização"};
      const statusResult = await supabase.from("products").update({
        status: statusMap[status] ? status : "offline",
        status_label: statusMap[status] || "Offline",
        active: body?.active === true || status === "online" || status === "updating",
        is_new: body?.isNew !== false,
      }).eq("id", createdId);

      if (statusResult.error) return NextResponse.json({error:"PRODUCT_STATUS_SAVE_FAILED",created:data},{status:400});

      if (presetPlans.length) {
        const names: Record<string,string> = {"trial":"Trial","1d":"1 Dia","3d":"3 Dias","7d":"7 Dias","15d":"15 Dias","30d":"30 Dias","90d":"90 Dias","lifetime":"Lifetime"};
        for (const code of presetPlans) {
          const createdPlan = await supabase.rpc("create_product_manager_plan",{
            p_product_id: createdId,
            p_name: names[code] || code.toUpperCase(),
            p_plan_code: code,
            p_price: 0,
          });
          if (createdPlan.error) {
            return NextResponse.json({error:"PLAN_PRESET_CREATE_FAILED",created:data},{status:400});
          }
        }
      }

      try {
        await syncProductExtras(supabase, createdId, body?.media, body?.features);
      } catch {
        return NextResponse.json({error:"PRODUCT_EXTRAS_SAVE_FAILED",created:data},{status:400});
      }
    }

    return NextResponse.json({ created: data }, { status: 201 });
  }

  if (action === "create_plan") {
    const productId = cleanString(body?.productId, 36);
    const name = cleanString(body?.name, 80);
    const code = cleanString(body?.planCode, 20).toLowerCase();
    const price = safePrice(body?.price);

    if (!UUID_RE.test(productId) || !name || !PLAN_CODES.has(code) || price === null) {
      return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("create_product_manager_plan", {
      p_product_id: productId,
      p_name: name,
      p_plan_code: code,
      p_price: price,
    });

    if (error || !data) {
      return NextResponse.json({ error: "PLAN_CREATE_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ created: data }, { status: 201 });
  }

  return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, isAdmin } = await adminClient();
  const denied = adminGuard(user, isAdmin);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const kind = cleanString(body?.kind, 20);

  if (kind === "product") {
    const product = body?.product || {};
    const productId = cleanString(product.id, 36);
    const gameId = cleanString(product.game_id, 36);
    const name = cleanString(product.name, 120);

    if (!UUID_RE.test(productId) || !UUID_RE.test(gameId) || !name) {
      return NextResponse.json({ error: "INVALID_PRODUCT" }, { status: 400 });
    }

    const roleId = nullableString(product.discord_role_id, 24);
    if (roleId && !/^[0-9]{17,20}$/.test(roleId)) return NextResponse.json({error:"Informe um ID de cargo Discord válido."},{status:400});
    const { data, error } = await supabase.rpc("save_product_manager_product", {
      p_product_id: productId,
      p_game_id: gameId,
      p_name: name,
      p_description: nullableString(product.description, 6000),
      p_features_text: nullableString(product.features_text, 6000),
      p_image_url: nullableString(product.image_url, 1000),
      p_is_new: Boolean(product.is_new),
      p_active: Boolean(product.active),
      p_sort_order: Math.max(-100000, Math.min(100000, safeInteger(product.sort_order))),
      p_status: cleanString(product.status || "undetected", 40),
      p_status_label: cleanString(product.status_label || "Indetectável", 80),
      p_emoji: nullableString(product.emoji, 32),
      p_accent_color: safeColor(product.accent_color),
      p_automation_flags: safeAutomationFlags(product.automation_flags),
      p_tutorial_ids: safeTutorialIds(product.tutorial_ids),
    });

    if (error || !data) {
      return NextResponse.json({ error: "PRODUCT_SAVE_FAILED" }, { status: 400 });
    }

    const { data: presentation, error: presentationError } = await supabase.rpc(
      "save_product_manager_presentation",
      {
        p_product_id: productId,
        p_description: nullableString(product.description, 6000),
        p_icon_url: safeAssetUrl(product.icon_url),
        p_banner_url: safeAssetUrl(product.banner_url || product.image_url),
        p_hide_delivery_badge: Boolean(product.hide_delivery_badge),
        p_auto_delivery: product?.automation_flags?.auto_delivery === true,
      }
    );

    if (presentationError) {
      return NextResponse.json({ error: "PRODUCT_PRESENTATION_SAVE_FAILED" }, { status: 400 });
    }

    try {
      await syncProductExtras(supabase, productId, product.media, product.features);
    } catch {
      return NextResponse.json({ error: "PRODUCT_EXTRAS_SAVE_FAILED" }, { status: 400 });
    }

    const {error: roleError} = await supabase.from("products").update({discord_role_id: roleId, discord_role_name: nullableString(product.discord_role_name,100) || "Cliente " + name}).eq("id",productId);
    if(roleError) return NextResponse.json({error:"Produto salvo, mas o cargo não foi atualizado. Tente novamente."},{status:500});
    return NextResponse.json({ saved: data, presentation });
  }

  if (kind === "plan") {
    const plan = body?.plan || {};
    const planId = cleanString(plan.id, 36);
    const name = cleanString(plan.name, 80);
    const price = safePrice(plan.price);
    const planCode = cleanString(plan.plan_code || "custom", 20).toLowerCase();
    const deliveryMode = cleanString(plan.delivery_mode || "manual", 40);

    if (
      !UUID_RE.test(planId) ||
      !name ||
      price === null ||
      !PLAN_CODES.has(planCode) ||
      !DELIVERY_MODES.has(deliveryMode)
    ) {
      return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });
    }

    const presetDurations: Record<string, number | null> = {trial:60,"1d":1440,"3d":4320,"7d":10080,"15d":21600,"30d":43200,"90d":129600,lifetime:null,single:null};
    const duration = planCode in presetDurations ? presetDurations[planCode] :
      plan.entitlement_duration_minutes === null ||
      plan.entitlement_duration_minutes === ""
        ? null
        : Math.max(1, Math.min(5_256_000, safeInteger(plan.entitlement_duration_minutes, 1)));

    const rolePosition =
      plan.discord_role_position === null || plan.discord_role_position === ""
        ? null
        : Math.max(0, Math.min(100000, safeInteger(plan.discord_role_position)));

    const automationFlags = safeAutomationFlags(plan.automation_flags);
    if (deliveryMode !== "purincash_supplier") {
      for (const key of Object.keys(automationFlags)) {
        if (key.startsWith("supplier_")) delete automationFlags[key];
      }
    }
    const supplierProvider = deliveryMode === "purincash_supplier"
      ? nullableString(plan.supplier_provider, 80)
      : null;
    const supplierProductId = deliveryMode === "purincash_supplier"
      ? nullableString(plan.supplier_product_id, 200)
      : null;
    const supplierVariationId = deliveryMode === "purincash_supplier"
      ? nullableString(plan.supplier_variation_id, 200)
      : null;
    const supplierVariationIndex = Number(automationFlags.supplier_variation_index);

    if (
      deliveryMode === "purincash_supplier" &&
      (
        supplierProvider !== "purincash" ||
        !supplierProductId ||
        !/^prod_[A-Za-z0-9_-]+$/.test(supplierProductId) ||
        !Number.isInteger(supplierVariationIndex) ||
        supplierVariationIndex < 0
      )
    ) {
      return NextResponse.json({ error: "SUPPLIER_BINDING_INVALID" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("save_product_manager_plan", {
      p_plan_id: planId,
      p_name: name,
      p_price: price,
      p_active: Boolean(plan.active),
      p_sort_order: Math.max(-100000, Math.min(100000, safeInteger(plan.sort_order))),
      p_plan_code: planCode,
      p_show_when_out_of_stock: Boolean(plan.show_when_out_of_stock),
      p_emoji: nullableString(plan.emoji, 32),
      p_accent_color: safeColor(plan.accent_color),
      p_delivery_mode: deliveryMode,
      p_discord_role_id: nullableString(plan.discord_role_id, 64),
      p_discord_role_name: nullableString(plan.discord_role_name, 100),
      p_discord_role_color: safeColor(plan.discord_role_color),
      p_discord_role_position: rolePosition,
      p_entitlement_duration_minutes: duration,
      p_supplier_provider: supplierProvider,
      p_supplier_product_id: supplierProductId,
      p_supplier_variation_id: supplierVariationId,
      p_automation_flags: automationFlags,
      p_tutorial_ids: safeTutorialIds(plan.tutorial_ids),
    });

    if (error || !data) {
      return NextResponse.json({ error: "PLAN_SAVE_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ saved: data });
  }

  return NextResponse.json({ error: "INVALID_KIND" }, { status: 400 });
}
