import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cleanString(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function nullableString(value: unknown, max = 500) {
  const valueString = cleanString(value, max);
  return valueString || null;
}

function slugify(value: unknown) {
  return cleanString(value, 100)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function color(value: unknown) {
  const normalized = nullableString(value, 7);
  if (!normalized) return null;
  return COLOR_RE.test(normalized) ? normalized.toUpperCase() : null;
}

async function adminContext() {
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

export async function GET() {
  const { supabase, user, isAdmin } = await adminContext();
  const denied = guard(user, isAdmin);
  if (denied) return denied;

  const { data, error } = await supabase.rpc("get_category_manager_catalog");
  if (error || !data) {
    return NextResponse.json({ error: "CATEGORY_MANAGER_UNAVAILABLE" }, { status: 500 });
  }

  return NextResponse.json(
    { catalog: data },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const { supabase, user, isAdmin } = await adminContext();
  const denied = guard(user, isAdmin);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const name = cleanString(body?.name, 100);
  const slug = slugify(body?.slug || name);
  const accentColor = color(body?.accent_color);

  if (!name || !slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
  }
  if (body?.accent_color && !accentColor) {
    return NextResponse.json({ error: "INVALID_ACCENT_COLOR" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("create_category_manager_category", {
    p_name: name,
    p_slug: slug,
    p_description: nullableString(body?.description, 1000),
    p_image_url: nullableString(body?.image_url, 1000),
    p_icon_url: nullableString(body?.icon_url, 1000),
    p_emoji: nullableString(body?.emoji, 32),
    p_accent_color: accentColor,
  });

  if (error || !data) {
    const conflict = String(error?.message || "").includes("CATEGORY_SLUG_EXISTS");
    return NextResponse.json(
      { error: conflict ? "CATEGORY_SLUG_EXISTS" : "CATEGORY_CREATE_FAILED" },
      { status: conflict ? 409 : 400 }
    );
  }

  return NextResponse.json({ created: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { supabase, user, isAdmin } = await adminContext();
  const denied = guard(user, isAdmin);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const category = body?.category || {};
  const id = cleanString(category.id, 36);
  const name = cleanString(category.name, 100);
  const slug = slugify(category.slug || name);
  const accentColor = color(category.accent_color);
  const sortOrderRaw = Number(category.sort_order);
  const sortOrder = Number.isFinite(sortOrderRaw)
    ? Math.max(-100000, Math.min(100000, Math.trunc(sortOrderRaw)))
    : 0;

  if (!UUID_RE.test(id) || !name || !slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
  }
  if (category?.accent_color && !accentColor) {
    return NextResponse.json({ error: "INVALID_ACCENT_COLOR" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("save_category_manager_category", {
    p_category_id: id,
    p_name: name,
    p_slug: slug,
    p_description: nullableString(category.description, 1000),
    p_image_url: nullableString(category.image_url, 1000),
    p_icon_url: nullableString(category.icon_url, 1000),
    p_emoji: nullableString(category.emoji, 32),
    p_accent_color: accentColor,
    p_active: Boolean(category.active),
    p_sort_order: sortOrder,
  });

  if (error || !data) {
    const conflict = String(error?.message || "").includes("CATEGORY_SLUG_EXISTS");
    return NextResponse.json(
      { error: conflict ? "CATEGORY_SLUG_EXISTS" : "CATEGORY_SAVE_FAILED" },
      { status: conflict ? 409 : 400 }
    );
  }

  return NextResponse.json({ saved: data });
}
