import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validComboDiscounts } from "@/core/commerce/policy";
export const dynamic = "force-dynamic";
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("commerce_combo_settings").select("discounts").eq("id", true).maybeSingle();
  if (error || !validComboDiscounts(data?.discounts)) return NextResponse.json({ error: "COMBO_SETTINGS_UNAVAILABLE" }, { status: 503 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
