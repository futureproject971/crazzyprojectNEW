import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { authenticated: false, connected: false, guildMember: false },
      { status: 401, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const { data, error } = await supabase
    .from("discord_identities")
    .select("discord_user_id,guild_id,guild_member,guild_verified_at,last_checked_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "GUILD_STATUS_UNAVAILABLE" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      connected: Boolean(data?.discord_user_id),
      guildMember: data?.guild_member === true,
      guildId: data?.guild_id || null,
      guildVerifiedAt: data?.guild_verified_at || null,
      lastCheckedAt: data?.last_checked_at || null,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
