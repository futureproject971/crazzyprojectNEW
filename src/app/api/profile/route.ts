import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  ProfileAvatarSource,
  ProfileBadge,
  ProfilePreferencesInput,
  ProfileSnapshot,
} from "@/modules/profile/types";

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function chooseAvatar(
  source: ProfileAvatarSource,
  profileAvatar: string | null,
  discordAvatar: string | null
) {
  if (source === "discord") return discordAvatar || profileAvatar;
  if (source === "crazzy") return profileAvatar || discordAvatar;
  return profileAvatar || discordAvatar;
}

function badge(
  id: ProfileBadge["id"],
  label: string,
  tone: ProfileBadge["tone"]
): ProfileBadge {
  return { id, label, tone };
}

async function currentUserOrResponse() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
      supabase,
      user: null,
    };
  }

  return { response: null, supabase, user };
}

export async function GET() {
  const auth = await currentUserOrResponse();
  if (auth.response || !auth.user) return auth.response;

  const { supabase, user } = auth;

  const [
    profileResult,
    preferencesResult,
    discordResult,
    rolesResult,
    grantsResult,
    entitlementsResult,
    paymentsResult,
    rankResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("username,avatar_url,banned,created_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_preferences")
      .select("display_name,bio,primary_color,avatar_source")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("discord_identities")
      .select("discord_user_id,username,global_name,avatar_url,guild_member,guild_verified_at,last_checked_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id),
    supabase
      .from("discord_role_grants")
      .select("id,role_name,status,granted_at,revoked_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("entitlements")
      .select("id,status,product_plans(plan_code)")
      .eq("user_id", user.id)
      .limit(100),
    supabase
      .from("payments")
      .select("id,status")
      .eq("user_id", user.id)
      .eq("status", "COMPLETED")
      .limit(100),
    supabase.rpc("get_my_rank"),
  ]);

  if (profileResult.data?.banned) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "ACCOUNT_BANNED" }, { status: 403 });
  }

  const preferences = preferencesResult.data;
  const avatarSource =
    preferences?.avatar_source === "crazzy" || preferences?.avatar_source === "discord"
      ? preferences.avatar_source
      : "auto";

  const profileAvatar = nullableString(profileResult.data?.avatar_url);
  const discordAvatar = nullableString(discordResult.data?.avatar_url);
  const username =
    nullableString(profileResult.data?.username) ||
    nullableString(discordResult.data?.global_name) ||
    nullableString(discordResult.data?.username) ||
    "Cliente CRAZZY";

  const displayName = nullableString(preferences?.display_name) || username;
  const appRoles = (rolesResult.data || [])
    .map((item) => String(item.role || ""))
    .filter(Boolean);

  if (!appRoles.includes("user")) appRoles.push("user");

  const entitlements = entitlementsResult.data || [];
  const activeEntitlements = entitlements.filter((item) => item.status === "active");
  const hasLifetime = activeEntitlements.some((item: any) => {
    const plan = Array.isArray(item.product_plans)
      ? item.product_plans[0]
      : item.product_plans;
    return String(plan?.plan_code || "").toLowerCase() === "lifetime";
  });

  const grantedRoles = (grantsResult.data || []).filter(
    (item) => item.status === "granted"
  );

  const badges: ProfileBadge[] = [badge("member", "CRAZZY MEMBER", "blue")];

  if (entitlements.length > 0 || (paymentsResult.data?.length || 0) > 0) {
    badges.push(badge("customer", "CLIENTE", "green"));
  }

  if (discordResult.data?.guild_member) {
    badges.push(badge("discord_verified", "DISCORD VERIFICADO", "blue"));
  }

  if (appRoles.includes("admin")) {
    badges.push(badge("admin", "ADMIN", "pink"));
  } else if (appRoles.includes("moderator")) {
    badges.push(badge("moderator", "MOD", "gold"));
  }

  if (hasLifetime) {
    badges.push(badge("lifetime", "LIFETIME", "gold"));
  }

  const rankData = rankResult.data && typeof rankResult.data === "object"
    ? (rankResult.data as any)
    : null;

  if (rankData?.current?.label) {
    const rankTone = ["blue","green","gold","pink","neutral"].includes(String(rankData.current.tone))
      ? rankData.current.tone
      : "blue";
    badges.push(badge("rank", String(rankData.current.label).toUpperCase(), rankTone));
  }

  const snapshot: ProfileSnapshot = {
    account: {
      id: user.id,
      username,
      displayName,
      email: user.email || null,
      profileAvatarUrl: profileAvatar,
      discordAvatarUrl: discordAvatar,
      avatarUrl: chooseAvatar(avatarSource, profileAvatar, discordAvatar),
      createdAt: profileResult.data?.created_at || user.created_at,
    },
    preferences: {
      displayName: nullableString(preferences?.display_name),
      bio: nullableString(preferences?.bio),
      primaryColor: String(preferences?.primary_color || "#0000FF").toUpperCase(),
      avatarSource,
    },
    discord: {
      connected: Boolean(discordResult.data?.discord_user_id),
      userId: discordResult.data?.discord_user_id || null,
      username: nullableString(discordResult.data?.username),
      globalName: nullableString(discordResult.data?.global_name),
      guildMember: Boolean(discordResult.data?.guild_member),
      guildVerifiedAt: discordResult.data?.guild_verified_at || null,
      lastCheckedAt: discordResult.data?.last_checked_at || null,
    },
    appRoles,
    discordRoles: (grantsResult.data || []).map((item) => ({
      id: item.id,
      roleName: item.role_name || "Cargo Discord",
      status: item.status,
      grantedAt: item.granted_at,
      revokedAt: item.revoked_at,
    })),
    badges,
    rank: rankData?.current ? {
      points: Number(rankData.points || 0),
      progressPercent: Number(rankData.progress_percent || 0),
      current: {
        code: String(rankData.current.code || "member"),
        label: String(rankData.current.label || "Member"),
        color: String(rankData.current.color || "#2AA8FF"),
        tone: ["blue","green","gold","pink","neutral"].includes(String(rankData.current.tone))
          ? rankData.current.tone
          : "blue",
      },
      next: rankData.next ? {
        code: String(rankData.next.code || ""),
        label: String(rankData.next.label || ""),
        minPoints: Number(rankData.next.min_points || 0),
        pointsNeeded: Number(rankData.next.points_needed || 0),
      } : null,
    } : null,
    stats: {
      entitlements: entitlements.length,
      activeEntitlements: activeEntitlements.length,
      completedPayments: paymentsResult.data?.length || 0,
      grantedDiscordRoles: grantedRoles.length,
    },
  };

  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await currentUserOrResponse();
  if (auth.response || !auth.user) return auth.response;

  const { supabase, user } = auth;

  const { data: profile } = await supabase
    .from("profiles")
    .select("banned")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.banned) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "ACCOUNT_BANNED" }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const displayName =
    raw.displayName === null || raw.displayName === ""
      ? null
      : nullableString(raw.displayName);

  if (displayName && (displayName.length < 2 || displayName.length > 32)) {
    return NextResponse.json({ error: "INVALID_DISPLAY_NAME" }, { status: 400 });
  }

  const bio =
    raw.bio === null || raw.bio === ""
      ? null
      : nullableString(raw.bio);

  if (bio && bio.length > 280) {
    return NextResponse.json({ error: "BIO_TOO_LONG" }, { status: 400 });
  }

  const primaryColor = String(raw.primaryColor || "").toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(primaryColor)) {
    return NextResponse.json({ error: "INVALID_PRIMARY_COLOR" }, { status: 400 });
  }

  const avatarSource = String(raw.avatarSource || "auto") as ProfileAvatarSource;
  if (!["auto", "crazzy", "discord"].includes(avatarSource)) {
    return NextResponse.json({ error: "INVALID_AVATAR_SOURCE" }, { status: 400 });
  }

  const input: ProfilePreferencesInput = {
    displayName,
    bio,
    primaryColor,
    avatarSource,
  };

  const { data, error } = await supabase
    .from("profile_preferences")
    .upsert(
      {
        user_id: user.id,
        display_name: input.displayName,
        bio: input.bio,
        primary_color: input.primaryColor,
        avatar_source: input.avatarSource,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("display_name,bio,primary_color,avatar_source")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "PROFILE_UPDATE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    preferences: {
      displayName: data.display_name,
      bio: data.bio,
      primaryColor: String(data.primary_color || "#0000FF").toUpperCase(),
      avatarSource: data.avatar_source,
    },
  });
}
