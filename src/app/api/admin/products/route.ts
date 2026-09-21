import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

export async function GET() {
  const { supabase, user, isAdmin } = await adminClient();

  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { data, error } = await supabase.rpc("get_product_manager_catalog");
  if (error || !data) {
    return NextResponse.json({ error: "PRODUCT_MANAGER_UNAVAILABLE" }, { status: 500 });
  }

  return NextResponse.json(
    { catalog: data },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, isAdmin } = await adminClient();

  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const kind = String(body?.kind || "");

  if (kind === "product") {
    const product = body?.product || {};
    const { data, error } = await supabase.rpc("save_product_manager_product", {
      p_product_id: String(product.id || ""),
      p_name: String(product.name || ""),
      p_description: String(product.description || ""),
      p_features_text: String(product.features_text || ""),
      p_image_url: String(product.image_url || ""),
      p_is_new: Boolean(product.is_new),
      p_active: Boolean(product.active),
      p_sort_order: Math.trunc(Number(product.sort_order || 0)),
      p_status: String(product.status || "undetected"),
      p_status_label: String(product.status_label || "Indetectável"),
      p_emoji: String(product.emoji || ""),
      p_accent_color: String(product.accent_color || ""),
      p_automation_flags:
        product.automation_flags && typeof product.automation_flags === "object"
          ? product.automation_flags
          : {},
      p_tutorial_ids: Array.isArray(product.tutorial_ids)
        ? product.tutorial_ids.map(String)
        : [],
    });

    if (error) {
      return NextResponse.json({ error: error.message || "PRODUCT_SAVE_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ saved: data });
  }

  if (kind === "plan") {
    const plan = body?.plan || {};
    const { data, error } = await supabase.rpc("save_product_manager_plan", {
      p_plan_id: String(plan.id || ""),
      p_name: String(plan.name || ""),
      p_price: Number(plan.price || 0),
      p_active: Boolean(plan.active),
      p_sort_order: Math.trunc(Number(plan.sort_order || 0)),
      p_plan_code: String(plan.plan_code || ""),
      p_show_when_out_of_stock: Boolean(plan.show_when_out_of_stock),
      p_emoji: String(plan.emoji || ""),
      p_accent_color: String(plan.accent_color || ""),
      p_delivery_mode: String(plan.delivery_mode || "manual"),
      p_discord_role_id: String(plan.discord_role_id || ""),
      p_discord_role_name: String(plan.discord_role_name || ""),
      p_discord_role_color: String(plan.discord_role_color || ""),
      p_discord_role_position:
        plan.discord_role_position === null || plan.discord_role_position === ""
          ? null
          : Math.max(0, Math.trunc(Number(plan.discord_role_position))),
      p_entitlement_duration_minutes:
        plan.entitlement_duration_minutes === null || plan.entitlement_duration_minutes === ""
          ? null
          : Math.max(1, Math.trunc(Number(plan.entitlement_duration_minutes))),
      p_supplier_provider: String(plan.supplier_provider || ""),
      p_supplier_product_id: String(plan.supplier_product_id || ""),
      p_supplier_variation_id: String(plan.supplier_variation_id || ""),
      p_automation_flags:
        plan.automation_flags && typeof plan.automation_flags === "object"
          ? plan.automation_flags
          : {},
      p_tutorial_ids: Array.isArray(plan.tutorial_ids)
        ? plan.tutorial_ids.map(String)
        : [],
    });

    if (error) {
      return NextResponse.json({ error: error.message || "PLAN_SAVE_FAILED" }, { status: 400 });
    }

    return NextResponse.json({ saved: data });
  }

  return NextResponse.json({ error: "INVALID_KIND" }, { status: 400 });
}
