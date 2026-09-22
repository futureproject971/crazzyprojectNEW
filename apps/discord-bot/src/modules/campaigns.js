import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
} from "discord.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function buildCampaignEmbed(campaign) {
  const embed = new EmbedBuilder().setColor(Number(campaign.color || 0x1687ff));

  if (campaign.title) embed.setTitle(String(campaign.title).slice(0, 256));
  if (campaign.description) embed.setDescription(String(campaign.description).slice(0, 4096));
  if (campaign.image_url) embed.setImage(campaign.image_url);
  if (campaign.thumbnail_url) embed.setThumbnail(campaign.thumbnail_url);
  if (campaign.footer_text) embed.setFooter({ text: String(campaign.footer_text).slice(0, 2048) });

  return embed;
}

export function buildCampaignComponents(campaign) {
  if (!campaign.link_url) return [];

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(String(campaign.button_label || "Acessar Loja").slice(0, 80))
      .setURL(campaign.link_url)
  );

  return [row];
}

export async function listTemplates(supabase) {
  const { data, error } = await supabase
    .from("discord_campaign_templates")
    .select("*")
    .eq("active", true)
    .order("name");

  if (error) throw error;
  return data || [];
}

export async function getTemplateByName(supabase, name) {
  const { data, error } = await supabase
    .from("discord_campaign_templates")
    .select("*")
    .ilike("name", String(name || "").trim())
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function queueTemplateCampaign({
  supabase,
  template,
  guildId,
  targetMode,
  targetRoleId = null,
  targetUserId = null,
}) {
  const { data, error } = await supabase
    .from("discord_campaigns")
    .insert({
      template_id: template.id,
      created_by: null,
      guild_id: guildId || null,
      title: template.title,
      description: template.description || "",
      image_url: template.image_url,
      thumbnail_url: template.thumbnail_url,
      link_url: template.link_url,
      button_label: template.button_label || "🛒 Acessar Loja",
      footer_text: template.footer_text,
      color: Number(template.color || 0x1687ff),
      target_mode: targetMode,
      target_role_id: targetRoleId,
      target_user_id: targetUserId,
      status: "queued",
      scheduled_for: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getRecipients(client, campaign, config) {
  const guildId = campaign.guild_id || config.guildId;
  const guild = await client.guilds.fetch(guildId);
  await guild.members.fetch();

  const members = guild.members.cache.filter((member) => !member.user.bot);

  if (campaign.target_mode === "single") {
    const id = String(campaign.target_user_id || "").trim();
    if (!id) return [];
    const member = members.get(id);
    if (member) return [member];

    try {
      const user = await client.users.fetch(id);
      return user ? [{ user, id: user.id }] : [];
    } catch {
      return [];
    }
  }

  if (campaign.target_mode === "online") {
    return [...members.values()].filter((member) =>
      ["online", "idle", "dnd"].includes(member.presence?.status)
    );
  }

  if (campaign.target_mode === "role") {
    const roleId = String(campaign.target_role_id || "").trim();
    if (!roleId) return [];
    return [...members.values()].filter((member) => member.roles.cache.has(roleId));
  }

  return [...members.values()];
}

async function cancelRequested(supabase, campaignId) {
  const { data } = await supabase
    .from("discord_campaigns")
    .select("cancel_requested,status")
    .eq("id", campaignId)
    .maybeSingle();

  return Boolean(data?.cancel_requested || data?.status === "cancelled");
}

async function recordDelivery(supabase, campaignId, discordUserId, status, errorCode = null) {
  await supabase
    .from("discord_campaign_deliveries")
    .upsert(
      {
        campaign_id: campaignId,
        discord_user_id: discordUserId,
        status,
        error_code: errorCode ? String(errorCode).slice(0, 120) : null,
        attempted_at: new Date().toISOString(),
      },
      { onConflict: "campaign_id,discord_user_id" }
    );
}

async function updateProgress(supabase, config, campaignId, counters) {
  await supabase.rpc("update_discord_campaign_progress", {
    p_campaign_id: campaignId,
    p_worker_id: config.workerId,
    p_total: counters.total,
    p_processed: counters.processed,
    p_success: counters.success,
    p_failed: counters.failed,
    p_skipped: counters.skipped,
  });
}

async function finishCampaign(supabase, config, campaignId, status, counters, lastError = null) {
  await supabase.rpc("finish_discord_campaign", {
    p_campaign_id: campaignId,
    p_worker_id: config.workerId,
    p_status: status,
    p_total: counters.total,
    p_processed: counters.processed,
    p_success: counters.success,
    p_failed: counters.failed,
    p_skipped: counters.skipped,
    p_last_error: lastError,
  });
}

export async function runCampaign(client, supabase, config, campaign) {
  const counters = {
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    const recipients = await getRecipients(client, campaign, config);
    counters.total = recipients.length;
    await updateProgress(supabase, config, campaign.id, counters);

    const embed = buildCampaignEmbed(campaign);
    const components = buildCampaignComponents(campaign);

    for (const recipient of recipients) {
      if (counters.processed % 10 === 0 && await cancelRequested(supabase, campaign.id)) {
        await finishCampaign(supabase, config, campaign.id, "cancelled", counters);
        return;
      }

      const user = recipient.user || recipient;
      const userId = String(user.id || recipient.id || "");

      if (!userId) {
        counters.processed += 1;
        counters.skipped += 1;
        continue;
      }

      try {
        await user.send({ embeds: [embed], components });
        counters.success += 1;
        await recordDelivery(supabase, campaign.id, userId, "success");
      } catch (error) {
        counters.failed += 1;
        const code = error?.code || error?.rawError?.code || "DM_FAILED";
        await recordDelivery(supabase, campaign.id, userId, "failed", code);
      }

      counters.processed += 1;

      if (
        counters.processed === counters.total ||
        counters.processed % 10 === 0
      ) {
        await updateProgress(supabase, config, campaign.id, counters);
      }

      await sleep(config.dmDelayMs);
    }

    await finishCampaign(supabase, config, campaign.id, "completed", counters);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishCampaign(supabase, config, campaign.id, "failed", counters, message);
  }
}

export function startCampaignWorker(client, supabase, config) {
  let processing = false;

  const tick = async () => {
    if (processing || !client.isReady()) return;
    processing = true;

    try {
      const { data, error } = await supabase.rpc("claim_discord_campaign", {
        p_worker_id: config.workerId,
      });

      if (error) throw error;
      if (data?.id) {
        await runCampaign(client, supabase, config, data);
      }
    } catch (error) {
      console.error("[campaigns] queue error:", error);
    } finally {
      processing = false;
    }
  };

  const timer = setInterval(() => void tick(), 5000);
  void tick();

  return () => clearInterval(timer);
}

export function startWorkerHeartbeat(client, supabase, config) {
  let cachedRoles = [];
  let cachedChannels = [];
  let lastRefresh = 0;

  const heartbeat = async () => {
    if (!client.isReady()) return;

    try {
      const guild = await client.guilds.fetch(config.guildId);
      const now = Date.now();

      if (now - lastRefresh > 60 * 1000) {
        await guild.members.fetch({ withPresences: true }).catch(() => guild.members.fetch().catch(() => undefined));
        await guild.channels.fetch().catch(() => undefined);

        cachedRoles = [...guild.roles.cache.values()]
          .filter((role) => role.id !== guild.id)
          .map((role) => ({
            id: role.id,
            name: role.name,
            color: role.color,
            position: role.position,
            member_count: role.members.size,
          }))
          .sort((a, b) => b.position - a.position)
          .slice(0, 100);

        cachedChannels = [...guild.channels.cache.values()]
          .filter((channel) =>
            [ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildVoice].includes(channel.type)
          )
          .sort((a, b) => a.rawPosition - b.rawPosition)
          .map((channel) => ({
            id: channel.id,
            name: channel.name,
            type:
              channel.type === ChannelType.GuildCategory
                ? "category"
                : channel.type === ChannelType.GuildVoice
                  ? "voice"
                  : "text",
            parent_id: channel.parentId || null,
            position: channel.rawPosition,
          }))
          .slice(0, 300);

        lastRefresh = now;
      }

      const onlineCount = guild.members.cache.filter((member) =>
        ["online", "idle", "dnd"].includes(member.presence?.status)
      ).size;

      await supabase.rpc("heartbeat_discord_bot_worker", {
        p_worker_id: config.workerId,
        p_guild_id: guild.id,
        p_guild_name: guild.name,
        p_bot_user_id: client.user?.id || null,
        p_bot_tag: client.user?.tag || null,
        p_connected: true,
        p_member_count: guild.memberCount || guild.members.cache.size,
        p_online_count: onlineCount,
        p_roles: cachedRoles,
        p_channels: cachedChannels,
        p_version: "3.0.0",
        p_last_error: null,
      });
    } catch (error) {
      console.error("[worker] heartbeat error:", error);
    }
  };

  const timer = setInterval(() => void heartbeat(), 20000);
  void heartbeat();

  return () => clearInterval(timer);
}
