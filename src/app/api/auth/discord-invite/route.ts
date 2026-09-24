import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_discord_invite");

  return NextResponse.json(
    {
      configured: !error && typeof data === "string" && data.length > 0,
      inviteUrl: !error && typeof data === "string" ? data : null,
    },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } }
  );
}
