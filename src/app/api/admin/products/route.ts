import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const PLAN_CODES = new Set([
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
  if (normalized.startsWith("/") || normalized.startsWith("https://")) return normalized;
  return null;
}

function safeTutorialIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter((item) => UUID_RE.test(item)))].slice(0, 200);
}

function safeAutomationFlags(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const keys = [
    "auto_delivery",
    "auto_discord_role",
    "auto_tutorial_unlock",
    "auto_expire",
  ];
  return Object.fromEntries(keys.map((key) => [key, input[key] === true]));
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

  return NextResponse.json(
    { catalog: data },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const { supabase, user, isAdmin } = await adminClient();
  const denied = adminGuard(user, isAdmin);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const action = cleanString(body?.action, 40);

  if (action === "create_product") {
    const gameId = cleanString(body?.gameId, 36);
    const name = cleanString(body?.name, 120);
    if (!UUID_RE.test(gameId) || !name) {
      return NextResponse.json({ error: "INVALID_PRODUCT" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("create_product_manager_product", {
      p_game_id: gameId,
      p_name: name,
      p_emoji: nullableString(body?.emoji, 32),
      p_accent_color: safeColor(body?.accentColor),
      p_create_default_plans: body?.createDefaultPlans !== false,
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
        p_auto_delivery: Boolean(body?.autoDelivery),
      });

      if (presentationError) {
        return NextResponse.json(
          { error: "PRODUCT_PRESENTATION_SAVE_FAILED", created: data },
          { status: 400 }
        );
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

    const duration =
      plan.entitlement_duration_minutes === null ||
      plan.entitlement_duration_minutes === ""
        ? null
        : Math.max(1, Math.min(5_256_000, safeInteger(plan.entitlement_duration_minutes, 1)));

    const rolePosition =
      plan.discord_role_position === null || plan.discord_role_position === ""
        ? null
        : Math.max(0, Math.min(100000, safeInteger(plan.discord_role_position)));

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
      p_supplier_provider: nullableString(plan.supplier_provider, 80),
      p_supplier_product_id: nullableString(plan.supplier_product_id, 200),
      p_supplier_variation_id: nullableString(plan.supplier_variation_id, 200),
      p_automation_flags: safeAutomationFlags(plan.automation_flags),
      p_tutorial_ids: safeTutorialIds(plan.tutorial_ids),
    });

    if (error || !data) {
      return NextResponse.json({ error: "PLAN_SAVE_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ saved: data });
  }

  return NextResponse.json({ error: "INVALID_KIND" }, { status: 400 });
}
