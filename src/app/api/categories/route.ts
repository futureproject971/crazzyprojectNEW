import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_categories");

  if (error || !data) {
    return NextResponse.json(
      { error: "CATEGORIES_UNAVAILABLE" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { categories: data },
    {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
    }
  );
}
