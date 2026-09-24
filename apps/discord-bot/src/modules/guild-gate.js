import { PermissionFlagsBits } from "discord.js";

export async function ensureOfficialDiscordInvite(client, supabase, config) {
  try {
    const { data: current, error: readError } = await supabase
      .from("system_credentials")
      .select("value")
      .eq("env_key", "DISCORD_INVITE_URL")
      .maybeSingle();

    if (readError) {
      console.error("[guild-gate] invite config read failed:", readError.code || readError.message);
      return null;
    }

    const existing = String(current?.value || "").trim();
    if (/^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9_-]+\/?$/.test(existing)) {
      return existing;
    }

    const guild = client.guilds.cache.get(config.guildId) || await client.guilds.fetch(config.guildId).catch(() => null);
    if (!guild) {
      console.warn("[guild-gate] official guild unavailable; invite was not created");
      return null;
    }

    await guild.channels.fetch().catch(() => null);
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me) {
      console.warn("[guild-gate] bot membership unavailable; invite was not created");
      return null;
    }

    const candidates = [
      guild.systemChannel,
      ...guild.channels.cache.values(),
    ].filter(Boolean);

    const channel = candidates.find((item) => {
      if (!item?.isTextBased?.() || typeof item.createInvite !== "function") return false;
      return item.permissionsFor?.(me)?.has(PermissionFlagsBits.CreateInstantInvite) === true;
    });

    if (!channel) {
      console.warn("[guild-gate] no text channel allows Create Instant Invite");
      return null;
    }

    const invite = await channel.createInvite({
      maxAge: 0,
      maxUses: 0,
      unique: true,
      reason: "CRAZZY PROJECT official website guild gate",
    });

    const url = String(invite?.url || "").trim();
    if (!url) return null;

    const { error: writeError } = await supabase
      .from("system_credentials")
      .update({ value: url })
      .eq("env_key", "DISCORD_INVITE_URL");

    if (writeError) {
      console.error("[guild-gate] invite config write failed:", writeError.code || writeError.message);
      return null;
    }

    console.log("[guild-gate] permanent official Discord invite configured");
    return url;
  } catch (error) {
    console.error("[guild-gate] automatic invite setup failed:", error?.message || error);
    return null;
  }
}


const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function startPendingGuildVerifier(client, supabase, config) {
  let running = false;

  const tick = async () => {
    if (running || !client.isReady()) return;
    running = true;

    try {
      const guild =
        client.guilds.cache.get(config.guildId) ||
        await client.guilds.fetch(config.guildId).catch(() => null);
      if (!guild) return;

      const { data: pending, error } = await supabase
        .from("discord_identities")
        .select("user_id,discord_user_id,last_checked_at")
        .eq("guild_member", false)
        .not("discord_user_id", "is", null)
        .order("last_checked_at", { ascending: true, nullsFirst: true })
        .limit(25);

      if (error) throw error;

      for (const identity of pending || []) {
        const discordUserId = String(identity.discord_user_id || "").trim();
        if (!/^\d{10,30}$/.test(discordUserId)) continue;

        const now = new Date().toISOString();
        try {
          const member = await guild.members.fetch(discordUserId);
          if (member) {
            const { error: updateError } = await supabase
              .from("discord_identities")
              .update({
                guild_id: config.guildId,
                guild_member: true,
                guild_verified_at: now,
                last_checked_at: now,
                updated_at: now,
              })
              .eq("user_id", identity.user_id)
              .eq("discord_user_id", discordUserId);

            if (updateError) throw updateError;
            console.log("[guild-gate] pending website login approved:", discordUserId);
          }
        } catch (memberError) {
          const code = Number(memberError?.code || 0);
          if (![10007, 10013].includes(code)) {
            console.warn("[guild-gate] pending member lookup failed:", discordUserId, memberError?.code || memberError?.message || memberError);
          }

          await supabase
            .from("discord_identities")
            .update({
              guild_id: config.guildId,
              guild_member: false,
              guild_verified_at: null,
              last_checked_at: now,
              updated_at: now,
            })
            .eq("user_id", identity.user_id)
            .eq("discord_user_id", discordUserId);
        }

        await wait(120);
      }
    } catch (error) {
      console.error("[guild-gate] pending verifier failed:", error?.message || error);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void tick(), 5000);
  void tick();
  return () => clearInterval(timer);
}
