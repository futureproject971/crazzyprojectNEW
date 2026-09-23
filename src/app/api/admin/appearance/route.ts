import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

async function context() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, admin: false };

  const { data, error } = await supabase.rpc("is_current_admin");
  return { supabase, user, admin: !error && data === true };
}

export async function GET() {
  const { supabase, user, admin } = await context();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { data, error } = await supabase
    .from("site_appearance")
    .select("*")
    .eq("id", "default")
    .single();

  if (error) return NextResponse.json({ error: "APPEARANCE_UNAVAILABLE" }, { status: 500 });
  return NextResponse.json({ appearance: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const { supabase, user, admin } = await context();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const defaultTheme = body?.defaultTheme === "light" ? "light" : "dark";
  const accentHex = String(body?.accentHex || "#0000FF").trim().toUpperCase();

  if (!HEX_RE.test(accentHex)) {
    return NextResponse.json({ error: "INVALID_ACCENT" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("site_appearance")
    .update({
      default_theme: defaultTheme,
      allow_user_theme: body?.allowUserTheme !== false,
      accent_hex: accentHex,
      motion_enabled: body?.motionEnabled !== false,
      ambient_effects: body?.ambientEffects !== false,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default")
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "APPEARANCE_SAVE_FAILED" }, { status: 400 });
  }

  return NextResponse.json({ appearance: data });
}
