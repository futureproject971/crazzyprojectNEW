import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

async function context() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: isAdmin, error } = await supabase.rpc("is_current_admin");
  return { supabase, user, isAdmin: !error && isAdmin === true };
}

function guard(user: unknown, isAdmin: boolean) {
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return null;
}

export async function GET(request: NextRequest) {
  const { supabase, user, isAdmin } = await context();
  const denied = guard(user, isAdmin);
  if (denied) return denied;

  const planId = clean(request.nextUrl.searchParams.get("planId"), 36);

  if (planId) {
    if (!UUID_RE.test(planId)) {
      return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });
    }

    const limitRaw = Number(request.nextUrl.searchParams.get("limit") || 100);
    const offsetRaw = Number(request.nextUrl.searchParams.get("offset") || 0);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(250, Math.trunc(limitRaw))) : 100;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.trunc(offsetRaw)) : 0;

    const { data, error } = await supabase.rpc("get_stock_manager_items", {
      p_product_plan_id: planId,
      p_limit: limit,
      p_offset: offset,
    });

    if (error || !data) {
      return NextResponse.json({ error: "STOCK_ITEMS_UNAVAILABLE" }, { status: 500 });
    }

    return NextResponse.json(
      { result: data },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const { data, error } = await supabase.rpc("get_stock_manager_catalog");
  if (error || !data) {
    return NextResponse.json({ error: "STOCK_MANAGER_UNAVAILABLE" }, { status: 500 });
  }

  return NextResponse.json(
    { catalog: data },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const { supabase, user, isAdmin } = await context();
  const denied = guard(user, isAdmin);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const planId = clean(body?.productPlanId, 36);
  const source = clean(body?.source || "manual", 80) || "manual";
  const note = clean(body?.note, 500) || null;
  const rawItems = Array.isArray(body?.items) ? body.items : [];

  if (!UUID_RE.test(planId) || rawItems.length < 1 || rawItems.length > 5000) {
    return NextResponse.json({ error: "INVALID_BATCH" }, { status: 400 });
  }

  const items = rawItems
    .map((item: unknown) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 5000);

  if (!items.length || items.some((item: string) => item.length > 4000)) {
    return NextResponse.json({ error: "INVALID_STOCK_ITEM" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("import_stock_batch", {
    p_product_plan_id: planId,
    p_items: items,
    p_source: source,
    p_note: note,
  });

  if (error || !data) {
    return NextResponse.json({ error: "STOCK_IMPORT_FAILED" }, { status: 400 });
  }

  return NextResponse.json({ batch: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, isAdmin } = await context();
  const denied = guard(user, isAdmin);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const itemId = clean(body?.stockItemId, 36);
  const disabled = body?.disabled === true;
  const reason = disabled ? clean(body?.reason, 500) || null : null;

  if (!UUID_RE.test(itemId)) {
    return NextResponse.json({ error: "INVALID_STOCK_ITEM" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("set_stock_item_disabled", {
    p_stock_item_id: itemId,
    p_disabled: disabled,
    p_reason: reason,
  });

  if (error || data !== true) {
    const message = String(error?.message || "");
    const status = message.includes("RESERVED") ? 409 : 400;
    return NextResponse.json(
      { error: message.includes("RESERVED") ? "STOCK_ITEM_RESERVED" : "STOCK_UPDATE_FAILED" },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
}
