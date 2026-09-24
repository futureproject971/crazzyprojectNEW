import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const fallback = {
  default_theme: "dark",
  allow_user_theme: true,
  accent_hex: "#0000FF",
  secondary_hex: "#00A3FF",
  background_hex: "#02060C",
  surface_hex: "#07101D",
  text_hex: "#F5F8FF",
  motion_enabled: true,
  ambient_effects: true,
  white_label_enabled: false,
  show_powered_by: true,
  brand_name: "CRAZZY PROJECT",
  tagline: "QUEM NAO XITA NAO BRILHA",
  logo_hero_url: "/brand/crazzy-logo-hero.png",
  logo_navbar_url: "/brand/crazzy-logo-navbar.png",
  favicon_url: "/favicon.ico",
  site_wallpaper_url: "",
  hero_cover_url: "/backgrounds/hero-tokyo.webp",
  discord_invite_cover_url: "",
};

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("site_appearance")
    .select("default_theme,allow_user_theme,accent_hex,secondary_hex,background_hex,surface_hex,text_hex,motion_enabled,ambient_effects,white_label_enabled,show_powered_by,brand_name,tagline,logo_hero_url,logo_navbar_url,favicon_url,site_wallpaper_url,hero_cover_url,discord_invite_cover_url,updated_at")
    .eq("id", "default")
    .maybeSingle();

  return NextResponse.json(error || !data ? fallback : data, {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" },
  });
}
