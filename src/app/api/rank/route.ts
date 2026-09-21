import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const action = request.nextUrl.searchParams.get("action") || "snapshot";

  if (action === "snapshot") {
    const [{ data: snapshot, error }, { data: tiers, error: tiersError }] =
      await Promise.all([
        supabase.rpc("get_my_rank"),
        supabase
          .from("rank_tiers")
          .select("code,label,min_points,color,tone,icon,sort_order")
          .eq("active", true)
          .order("min_points", { ascending: true }),
      ]);

    if (error || tiersError || !snapshot) {
      return NextResponse.json(
        { error: "Não foi possível carregar seu rank." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        snapshot,
        tiers: tiers || [],
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (action === "leaderboard") {
    const limit = Math.max(
      1,
      Math.min(50, Number(request.nextUrl.searchParams.get("limit") || 25) || 25)
    );
    const { data, error } = await supabase.rpc("get_rank_leaderboard", {
      p_limit: limit,
    });

    if (error) {
      return NextResponse.json(
        { error: "Não foi possível carregar o ranking." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { leaderboard: Array.isArray(data) ? data : [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
