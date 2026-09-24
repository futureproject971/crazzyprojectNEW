import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function text(value: unknown, fallback: string, max: number) {
  const next = String(value || "").trim().slice(0, max);
  return next || fallback;
}

function asset(value: unknown, fallback = "") {
  const next = String(value || "").trim();
  if (!next) return fallback;
  if (next.startsWith("/") || /^https:\/\//i.test(next)) return next.slice(0, 500);
  return fallback;
}

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

  const { data, error } = await supabase.from("site_appearance").select("*").eq("id", "default").single();
  if (error) return NextResponse.json({ error: "APPEARANCE_UNAVAILABLE" }, { status: 500 });
  return NextResponse.json({ appearance: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const { supabase, user, admin } = await context();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const colors = [
    String(body?.accentHex || "#0000FF").toUpperCase(),
    String(body?.secondaryHex || "#00A3FF").toUpperCase(),
    String(body?.backgroundHex || "#02060C").toUpperCase(),
    String(body?.surfaceHex || "#07101D").toUpperCase(),
    String(body?.textHex || "#F5F8FF").toUpperCase(),
  ];
  if (colors.some((value) => !HEX_RE.test(value))) {
    return NextResponse.json({ error: "INVALID_COLOR" }, { status: 400 });
  }

  const update = {
    default_theme: body?.defaultTheme === "light" ? "light" : "dark",
    allow_user_theme: body?.allowUserTheme !== false,
    accent_hex: colors[0],
    secondary_hex: colors[1],
    background_hex: colors[2],
    surface_hex: colors[3],
    text_hex: colors[4],
    motion_enabled: body?.motionEnabled !== false,
    ambient_effects: body?.ambientEffects !== false,
    white_label_enabled: body?.whiteLabelEnabled === true,
    show_powered_by: body?.showPoweredBy !== false,
    brand_name: text(body?.brandName, "CRAZZY PROJECT", 60),
    tagline: text(body?.tagline, "QUEM NAO XITA NAO BRILHA", 120),
    logo_hero_url: asset(body?.logoHeroUrl, "/brand/crazzy-logo-hero.png"),
    logo_navbar_url: asset(body?.logoNavbarUrl, "/brand/crazzy-logo-navbar.png"),
    favicon_url: asset(body?.faviconUrl, "/favicon.ico"),
    site_wallpaper_url: asset(body?.siteWallpaperUrl, ""),
    hero_cover_url: asset(body?.heroCoverUrl, "/backgrounds/hero-tokyo.webp"),
    discord_invite_cover_url: asset(body?.discordInviteCoverUrl, ""),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("site_appearance")
    .update(update)
    .eq("id", "default")
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: "APPEARANCE_SAVE_FAILED" }, { status: 400 });
  return NextResponse.json({ appearance: data });
}
