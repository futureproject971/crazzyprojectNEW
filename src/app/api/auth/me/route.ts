import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole, AuthMe } from "@/modules/auth/types";

const roleRank: Record<AppRole, number> = {
  user: 1,
  moderator: 2,
  admin: 3,
};

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const [profileResult, rolesResult, discordResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("username,avatar_url,banned")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id),
    supabase
      .from("discord_identities")
      .select("discord_user_id,username,global_name,avatar_url,guild_id,guild_member,guild_verified_at,last_checked_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    return NextResponse.json({ error: "PROFILE_UNAVAILABLE" }, { status: 500 });
  }

  if (profileResult.data?.banned) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "ACCOUNT_BANNED" }, { status: 403 });
  }

  const roles = (rolesResult.data || [])
    .map((item) => item.role)
    .filter((role): role is AppRole =>
      role === "user" || role === "moderator" || role === "admin"
    );

  if (!roles.includes("user")) roles.push("user");
  const role =
    [...roles].sort((a, b) => roleRank[b] - roleRank[a])[0] || "user";

  const profile = profileResult.data;
  const discord = discordResult.data;

  const payload: AuthMe = {
    id: user.id,
    email: user.email || null,
    username:
      profile?.username ||
      String(user.user_metadata?.preferred_username || user.user_metadata?.name || "Meu Painel"),
    avatarUrl: profile?.avatar_url || null,
    role,
    roles,
    banned: false,
    discord: {
      connected: Boolean(discord?.discord_user_id),
      userId: discord?.discord_user_id || null,
      username: discord?.username || null,
      globalName: discord?.global_name || null,
      avatarUrl: discord?.avatar_url || null,
      guildId: discord?.guild_id || null,
      guildMember: Boolean(discord?.guild_member),
      guildVerifiedAt: discord?.guild_verified_at || null,
      lastCheckedAt: discord?.last_checked_at || null,
    },
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
