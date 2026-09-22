import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { config } from "../config.js";
import { supabase } from "../lib/supabase.js";

const editors = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function baseEditor(mode = "all") {
  return {
    mode,
    title: "",
    description: "",
    image_url: "",
    thumbnail_url: "",
    link_url: "",
    color: 0x0000ff,
    button_label: "🛒 Acessar Loja",
    footer_text: "",
  };
}

function buildEmbed(data) {
  const embed = new EmbedBuilder()
    .setColor(Number(data.color) || 0x0000ff)
    .setDescription(data.description || "🧩 Monte sua embed antes de enviar.");
  if (data.title) embed.setTitle(data.title);
  if (data.image_url) embed.setImage(data.image_url);
  if (data.thumbnail_url) embed.setThumbnail(data.thumbnail_url);
  if (data.footer_text) embed.setFooter({ text: data.footer_text });
  return embed;
}

function linkComponents(data) {
  if (!data.link_url) return [];
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(data.button_label || "🛒 Acessar Loja")
        .setStyle(ButtonStyle.Link)
        .setURL(data.link_url)
    ),
  ];
}

function editorComponents(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("campaign:title:" + userId).setLabel("📝 Título").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("campaign:description:" + userId).setLabel("✏️ Descrição").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("campaign:image:" + userId).setLabel("🖼️ Imagem").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("campaign:link:" + userId).setLabel("🔗 Link").setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("campaign:color:" + userId).setLabel("🎨 Cor").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("campaign:save:" + userId).setLabel("⭐ Salvar template").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("campaign:send:" + userId).setLabel("📤 Colocar na fila").setStyle(ButtonStyle.Success)
    ),
  ];
}

function modalFor(field, userId, value = "") {
  const labels = {
    title: ["Título", "Título da embed", TextInputStyle.Short, 256],
    description: ["Descrição", "Mensagem da embed", TextInputStyle.Paragraph, 4000],
    image: ["Imagem", "URL https:// da imagem", TextInputStyle.Short, 1200],
    link: ["Link", "URL https:// do botão", TextInputStyle.Short, 1200],
    color: ["Cor", "#0000FF", TextInputStyle.Short, 7],
    save: ["Salvar template", "Nome do template", TextInputStyle.Short, 80],
  };
  const [title, label, style, maxLength] = labels[field];
  return new ModalBuilder()
    .setCustomId("campaignmodal:" + field + ":" + userId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("value")
          .setLabel(label)
          .setStyle(style)
          .setMaxLength(maxLength)
          .setRequired(field === "description" || field === "save")
          .setValue(String(value || "").slice(0, maxLength))
      )
    );
}

async function queueCampaign({ guildId, data, mode, templateId = null, targetRoleId = null, targetUserId = null }) {
  const { data: row, error } = await supabase
    .from("discord_campaigns")
    .insert({
      template_id: templateId,
      guild_id: guildId || config.guildId || null,
      title: data.title || null,
      description: data.description || "",
      image_url: data.image_url || null,
      thumbnail_url: data.thumbnail_url || null,
      link_url: data.link_url || null,
      button_label: data.button_label || "🛒 Acessar Loja",
      footer_text: data.footer_text || null,
      color: Number(data.color) || 0x0000ff,
      target_mode: mode,
      target_role_id: targetRoleId,
      target_user_id: targetUserId,
      status: "queued",
      scheduled_for: new Date().toISOString(),
    })
    .select("id,status")
    .single();
  if (error) throw error;
  return row;
}

async function getTemplate(name) {
  const { data } = await supabase
    .from("discord_campaign_templates")
    .select("*")
    .ilike("name", name)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  return data;
}

async function saveTemplate(name, data) {
  const payload = {
    name,
    title: data.title || null,
    description: data.description || "",
    image_url: data.image_url || null,
    thumbnail_url: data.thumbnail_url || null,
    link_url: data.link_url || null,
    button_label: data.button_label || "🛒 Acessar Loja",
    footer_text: data.footer_text || null,
    color: Number(data.color) || 0x0000ff,
    active: true,
    updated_at: new Date().toISOString(),
  };
  const existing = await getTemplate(name);
  if (existing?.id) {
    const { error } = await supabase.from("discord_campaign_templates").update(payload).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data: inserted, error } = await supabase.from("discord_campaign_templates").insert(payload).select("id").single();
  if (error) throw error;
  return inserted.id;
}

function templateToEditor(template, mode = "all") {
  return {
    mode,
    title: template.title || "",
    description: template.description || "",
    image_url: template.image_url || "",
    thumbnail_url: template.thumbnail_url || "",
    link_url: template.link_url || "",
    button_label: template.button_label || "🛒 Acessar Loja",
    footer_text: template.footer_text || "",
    color: Number(template.color) || 0x0000ff,
  };
}

export async function handleCampaignInteraction(interaction) {
  if (interaction.isChatInputCommand() && ["disparar", "dispararonline"].includes(interaction.commandName)) {
    const mode = interaction.commandName === "dispararonline" ? "online" : "all";
    const data = baseEditor(mode);
    editors.set(interaction.user.id, data);
    await interaction.reply({
      content: "🎛️ Editor rápido aberto. Público: **" + (mode === "online" ? "somente online" : "todos") + "**. O envio final entra na fila do site.",
      embeds: [buildEmbed(data)],
      components: editorComponents(interaction.user.id),
      ephemeral: true,
    });
    return true;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "predef") {
    const sub = interaction.options.getSubcommand();
    if (sub === "list") {
      const { data } = await supabase.from("discord_campaign_templates").select("name").eq("active", true).order("name");
      const names = (data || []).map((item) => item.name);
      await interaction.reply({
        content: names.length ? "📂 Templates: " + names.join(", ") : "📂 Nenhum template salvo.",
        ephemeral: true,
      });
      return true;
    }

    const name = interaction.options.getString("name", true).trim();
    if (sub === "remove") {
      const { error } = await supabase
        .from("discord_campaign_templates")
        .update({ active: false, updated_at: new Date().toISOString() })
        .ilike("name", name);
      await interaction.reply({
        content: error ? "❌ Não consegui desativar o template." : "🗑️ Template **" + name + "** desativado.",
        ephemeral: true,
      });
      return true;
    }

    if (sub === "save") {
      const current = editors.get(interaction.user.id);
      if (!current) {
        await interaction.reply({ content: "❌ Abra primeiro /disparar ou /dispararonline e monte a embed.", ephemeral: true });
        return true;
      }
      await saveTemplate(name, current);
      await interaction.reply({ content: "✅ Template **" + name + "** salvo no site/Supabase.", ephemeral: true });
      return true;
    }

    const template = await getTemplate(name);
    if (!template) {
      await interaction.reply({ content: "❌ Template **" + name + "** não encontrado.", ephemeral: true });
      return true;
    }

    const data = templateToEditor(template, interaction.options.getBoolean("only_online") ? "online" : "all");
    if (sub === "preview") {
      await interaction.reply({ content: "👀 Prévia de **" + name + "**:", embeds: [buildEmbed(data)], components: linkComponents(data), ephemeral: true });
      return true;
    }

    if (sub === "send") {
      const row = await queueCampaign({ guildId: interaction.guildId, data, mode: data.mode, templateId: template.id });
      await interaction.reply({ content: "✅ Campanha **" + name + "** adicionada à fila. ID: " + row.id, ephemeral: true });
      return true;
    }
  }

  if (interaction.isButton() && interaction.customId.startsWith("campaign:")) {
    const [, action, owner] = interaction.customId.split(":");
    if (interaction.user.id !== owner) {
      await interaction.reply({ content: "❌ Esse editor não é seu.", ephemeral: true });
      return true;
    }
    const data = editors.get(owner) || baseEditor();
    if (["title", "description", "image", "link", "color", "save"].includes(action)) {
      const values = {
        title: data.title,
        description: data.description,
        image: data.image_url,
        link: data.link_url,
        color: "#" + Number(data.color || 0x0000ff).toString(16).padStart(6, "0"),
        save: "",
      };
      await interaction.showModal(modalFor(action, owner, values[action]));
      return true;
    }
    if (action === "send") {
      const row = await queueCampaign({ guildId: interaction.guildId, data, mode: data.mode || "all" });
      await interaction.update({
        content: "✅ Campanha na fila do CRAZZY PROJECT. ID: " + row.id + "\nAcompanhe pelo painel /admin/campanhas.",
        embeds: [buildEmbed(data)],
        components: [],
      });
      return true;
    }
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("campaignmodal:")) {
    const [, field, owner] = interaction.customId.split(":");
    if (interaction.user.id !== owner) {
      await interaction.reply({ content: "❌ Esse editor não é seu.", ephemeral: true });
      return true;
    }
    const value = interaction.fields.getTextInputValue("value").trim();
    const data = editors.get(owner) || baseEditor();
    if (field === "save") {
      if (!value) {
        await interaction.reply({ content: "❌ Informe um nome.", ephemeral: true });
        return true;
      }
      await saveTemplate(value, data);
      await interaction.reply({ content: "✅ Template **" + value + "** salvo no painel.", ephemeral: true });
      return true;
    }
    if (field === "title") data.title = value;
    if (field === "description") data.description = value;
    if (field === "image") data.image_url = value;
    if (field === "link") data.link_url = value;
    if (field === "color" && /^#[0-9a-f]{6}$/i.test(value)) data.color = Number.parseInt(value.slice(1), 16);
    editors.set(owner, data);
    await interaction.update({
      content: "🎛️ Preview atualizado. O site usa a mesma base de templates.",
      embeds: [buildEmbed(data)],
      components: editorComponents(owner),
    });
    return true;
  }

  return false;
}

async function recipientsFor(guild, campaign) {
  try {
    await guild.members.fetch({ withPresences: true });
  } catch {
    await guild.members.fetch();
  }

  let members = [...guild.members.cache.values()].filter((member) => !member.user.bot);
  if (campaign.target_mode === "online") {
    members = members.filter((member) => ["online", "idle", "dnd"].includes(member.presence?.status));
  } else if (campaign.target_mode === "role") {
    members = members.filter((member) => member.roles.cache.has(campaign.target_role_id));
  } else if (campaign.target_mode === "single") {
    members = members.filter((member) => member.id === campaign.target_user_id);
  }
  return members;
}

async function recordDelivery(campaignId, userId, status, errorCode = null) {
  await supabase.from("discord_campaign_deliveries").upsert(
    {
      campaign_id: campaignId,
      discord_user_id: userId,
      status,
      error_code: errorCode ? String(errorCode).slice(0, 120) : null,
      attempted_at: new Date().toISOString(),
    },
    { onConflict: "campaign_id,discord_user_id" }
  );
}

async function processCampaign(client, campaign) {
  const guildId = campaign.guild_id || config.guildId;
  if (!guildId) throw new Error("GUILD_ID_REQUIRED");

  const guild = await client.guilds.fetch(guildId);
  const members = await recipientsFor(guild, campaign);
  const embed = buildEmbed(campaign);
  const components = linkComponents(campaign);
  let success = 0;
  let failed = 0;
  let skipped = 0;
  let processed = 0;

  await supabase.rpc("update_discord_campaign_progress", {
    p_campaign_id: campaign.id,
    p_worker_id: config.workerId,
    p_total: members.length,
    p_processed: 0,
    p_success: 0,
    p_failed: 0,
    p_skipped: 0,
  });

  for (const member of members) {
    if (processed % 10 === 0) {
      const { data: state } = await supabase.from("discord_campaigns").select("cancel_requested").eq("id", campaign.id).single();
      if (state?.cancel_requested) {
        await supabase.rpc("finish_discord_campaign", {
          p_campaign_id: campaign.id,
          p_worker_id: config.workerId,
          p_status: "cancelled",
          p_total: members.length,
          p_processed: processed,
          p_success: success,
          p_failed: failed,
          p_skipped: skipped,
          p_last_error: null,
        });
        return;
      }
    }

    try {
      await member.send({ embeds: [embed], components });
      success += 1;
      await recordDelivery(campaign.id, member.id, "success");
    } catch (error) {
      failed += 1;
      await recordDelivery(campaign.id, member.id, "failed", error?.code || error?.message || "DM_FAILED");
    }

    processed += 1;
    if (processed % 5 === 0 || processed === members.length) {
      await supabase.rpc("update_discord_campaign_progress", {
        p_campaign_id: campaign.id,
        p_worker_id: config.workerId,
        p_total: members.length,
        p_processed: processed,
        p_success: success,
        p_failed: failed,
        p_skipped: skipped,
      });
    }
    await sleep(config.sleepMs);
  }

  await supabase.rpc("finish_discord_campaign", {
    p_campaign_id: campaign.id,
    p_worker_id: config.workerId,
    p_status: "completed",
    p_total: members.length,
    p_processed: processed,
    p_success: success,
    p_failed: failed,
    p_skipped: skipped,
    p_last_error: null,
  });
}

let busy = false;
export async function pollCampaignQueue(client) {
  if (busy || !client.isReady()) return;
  busy = true;
  try {
    const { data: campaign, error } = await supabase.rpc("claim_discord_campaign", { p_worker_id: config.workerId });
    if (error) throw error;
    if (!campaign) return;
    try {
      await processCampaign(client, campaign);
    } catch (error) {
      console.error("[campaign-worker]", error);
      await supabase.rpc("finish_discord_campaign", {
        p_campaign_id: campaign.id,
        p_worker_id: config.workerId,
        p_status: "failed",
        p_total: Number(campaign.total_recipients) || 0,
        p_processed: Number(campaign.processed_count) || 0,
        p_success: Number(campaign.success_count) || 0,
        p_failed: Number(campaign.failed_count) || 0,
        p_skipped: Number(campaign.skipped_count) || 0,
        p_last_error: String(error?.message || "CAMPAIGN_FAILED").slice(0, 1000),
      });
    }
  } finally {
    busy = false;
  }
}

export async function heartbeatBotWorker(client) {
  if (!client.isReady()) return;
  const guildId = config.guildId || client.guilds.cache.first()?.id;
  const guild = guildId ? client.guilds.cache.get(guildId) : null;
  let memberCount = guild?.memberCount || 0;
  let onlineCount = 0;
  let roles = [];
  let channels = [];

  if (guild) {
    try {
      await guild.members.fetch({ withPresences: true });
    } catch {}
    try {
      await guild.channels.fetch();
    } catch {}

    memberCount = guild.memberCount || guild.members.cache.size;
    onlineCount = guild.members.cache.filter((member) => ["online", "idle", "dnd"].includes(member.presence?.status)).size;
    roles = guild.roles.cache
      .filter((role) => role.id !== guild.roles.everyone.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
        member_count: guild.members.cache.filter((member) => member.roles.cache.has(role.id)).size,
      }))
      .slice(0, 100);
    channels = guild.channels.cache
      .filter((channel) => [ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildVoice].includes(channel.type))
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type === ChannelType.GuildCategory ? "category" : channel.type === ChannelType.GuildVoice ? "voice" : "text",
        parent_id: channel.parentId || null,
        position: channel.rawPosition,
      }))
      .slice(0, 300);
  }

  await supabase.rpc("heartbeat_discord_bot_worker", {
    p_worker_id: config.workerId,
    p_guild_id: guild?.id || guildId || null,
    p_guild_name: guild?.name || null,
    p_bot_user_id: client.user?.id || null,
    p_bot_tag: client.user?.tag || null,
    p_connected: true,
    p_member_count: memberCount,
    p_online_count: onlineCount,
    p_roles: roles,
    p_channels: channels,
    p_version: "bot-core/1.1.0",
    p_last_error: null,
  });
}