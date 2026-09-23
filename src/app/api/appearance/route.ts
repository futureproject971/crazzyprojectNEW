import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const fallback = {
  default_theme: "dark",
  allow_user_theme: true,
  accent_hex: "#0000FF",
  motion_enabled: true,
  ambient_effects: true,
};

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("site_appearance")
    .select("default_theme,allow_user_theme,accent_hex,motion_enabled,ambient_effects,updated_at")
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(fallback, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" },
    });
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" },
  });
}
