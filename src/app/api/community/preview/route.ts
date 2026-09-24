import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const channel = request.nextUrl.searchParams.get("channel") || "geral";
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") || 8);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(Math.floor(rawLimit), 20))
    : 8;

  const { data, error } = await supabase.rpc("get_public_community_preview", {
    p_channel: channel,
    p_limit: limit,
  });

  if (error) {
    return NextResponse.json(
      { error: "COMMUNITY_PREVIEW_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    data || {
      channel: {
        slug: "geral",
        name: "Chat Geral",
        description: "Converse com a comunidade CRAZZY PROJECT.",
      },
      messages: [],
      activity: { recentUsers: 0 },
    },
    { headers: { "Cache-Control": "public, max-age=3, stale-while-revalidate=10" } }
  );
}
