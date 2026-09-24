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
