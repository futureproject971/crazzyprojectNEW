import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const query = String(request.nextUrl.searchParams.get("q") || "").slice(0, 120);
  const limit = Math.max(
    1,
    Math.min(100, Number(request.nextUrl.searchParams.get("limit") || 50) || 50)
  );

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_help_content", {
    p_query: query,
    p_limit: limit,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: "Não foi possível pesquisar a central de ajuda." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      query: typeof (data as any).query === "string" ? (data as any).query : "",
      faqs: Array.isArray((data as any).faqs) ? (data as any).faqs : [],
      tutorials: Array.isArray((data as any).tutorials) ? (data as any).tutorials : [],
    },
    { headers: { "Cache-Control": "public, max-age=20, stale-while-revalidate=60" } }
  );
}
