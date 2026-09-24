import { createClient } from "https://esm.sh/@supabase/supabase-js@2.109.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.default) return String(parsed.default);
    } catch {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function publicKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.default) return String(parsed.default);
    } catch {}
  }
  return Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
}

type DiscordUser = {
  id: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
};

function avatarUrl(user: DiscordUser) {
  if (!user.avatar) return null;
  const ext = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.${ext}?size=128`;
}

async function discordGet(path: string, token: string) {
  return fetch("https://discord.com/api/v10" + path, {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
      "User-Agent": "CRAZZY-PROJECT-Auth/1.0",
    },
    signal: AbortSignal.timeout(12_000),
  });
}

async function configValue(admin: any, envKey: string) {
  const env = (Deno.env.get(envKey) || "").trim();
  if (env) return env;

  const { data } = await admin
    .from("system_credentials")
    .select("value")
    .eq("env_key", envKey)
    .maybeSingle();

  return String(data?.value || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const adminKey = secretKey();
  const browserKey = publicKey();
  const authHeader = req.headers.get("Authorization") || "";

  if (!supabaseUrl || !adminKey || !browserKey) {
    return json({ error: "AUTH_BACKEND_NOT_CONFIGURED" }, 503);
  }
  if (!authHeader.startsWith("Bearer ")) return json({ error: "UNAUTHORIZED" }, 401);

  const scoped = createClient(supabaseUrl, browserKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await scoped.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "UNAUTHORIZED" }, 401);

  const admin = createClient(supabaseUrl, adminKey);
  const { data: profile } = await admin
    .from("profiles")
    .select("banned")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.banned) return json({ error: "ACCOUNT_BANNED" }, 403);

  const body = await req.json().catch(() => null);
  const providerToken = String(body?.provider_token || "").trim();
  if (!providerToken || providerToken.length > 4096) {
    return json({ error: "DISCORD_PROVIDER_TOKEN_REQUIRED" }, 400);
  }

  const meResponse = await discordGet("/users/@me", providerToken);
  if (!meResponse.ok) {
    return json({ error: "DISCORD_IDENTITY_FAILED", provider_status: meResponse.status }, 502);
  }
  const discordUser = await meResponse.json() as DiscordUser;
  if (!/^\d{10,30}$/.test(String(discordUser.id || ""))) {
    return json({ error: "INVALID_DISCORD_IDENTITY" }, 502);
  }

  const guildId = await configValue(admin, "DISCORD_GUILD_ID");
  let guildMember = false;
  let guildCheckConfigured = Boolean(guildId);

  if (guildId) {
    const guildsResponse = await discordGet("/users/@me/guilds", providerToken);
    if (!guildsResponse.ok) {
      return json({ error: "DISCORD_GUILDS_FAILED", provider_status: guildsResponse.status }, 502);
    }
    const guilds = await guildsResponse.json();
    guildMember = Array.isArray(guilds) && guilds.some((guild: any) => String(guild?.id || "") === guildId);
  }

  const now = new Date().toISOString();
  const avatar = avatarUrl(discordUser);
  const username = String(discordUser.global_name || discordUser.username || "usuario").slice(0, 80);

  const { error: identityError } = await admin
    .from("discord_identities")
    .upsert({
      user_id: user.id,
      discord_user_id: String(discordUser.id),
      username: String(discordUser.username || "").slice(0, 80) || null,
      global_name: String(discordUser.global_name || "").slice(0, 80) || null,
      avatar_url: avatar,
      guild_id: guildId || null,
      guild_member: guildMember,
      guild_verified_at: guildMember ? now : null,
      last_checked_at: now,
      updated_at: now,
    }, { onConflict: "user_id" });

  if (identityError) {
    console.error("[auth-discord-sync] identity upsert failed", identityError.code);
    return json({ error: "IDENTITY_PERSIST_FAILED" }, 500);
  }

  await admin
    .from("profiles")
    .update({
      username,
      avatar_url: avatar,
      updated_at: now,
    })
    .eq("user_id", user.id);

  await admin
    .from("user_roles")
    .upsert({ user_id: user.id, role: "user" }, { onConflict: "user_id,role" });

  const ownerDiscordId = await configValue(admin, "CRAZZY_OWNER_DISCORD_ID");
  const ownerMatch =
    /^\d{10,30}$/.test(ownerDiscordId) &&
    String(discordUser.id) === ownerDiscordId;

  if (ownerMatch) {
    const { error: ownerRoleError } = await admin
      .from("user_roles")
      .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });

    if (ownerRoleError) {
      console.error("[auth-discord-sync] owner admin role failed", ownerRoleError.code);
      return json({ error: "OWNER_ROLE_PERSIST_FAILED" }, 500);
    }
  }

  return json({
    success: true,
    discordUserId: String(discordUser.id),
    username,
    avatarUrl: avatar,
    guildCheckConfigured,
    guildMember,
    ownerAdmin: ownerMatch,
  });
});
