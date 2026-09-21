import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_academy_catalog");

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível carregar a CRAZZY ACADEMY." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { tutorials: Array.isArray(data) ? data : [] },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
