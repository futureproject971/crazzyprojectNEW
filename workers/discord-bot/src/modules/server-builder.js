import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { readFileSync } from "node:fs";
import { config } from "../config.js";
import { supabase } from "../lib/supabase.js";

const readJson = (relative) => JSON.parse(readFileSync(new URL(relative, import.meta.url), "utf8"));
const fallbackTemplate = readJson("../../config/server-template.json");
const fallbackTheme = readJson("../../config/theme.json");
const localSafety = readJson("../../config/safety.json");
const normalize = (value) => String(value || "").trim().toLowerCase();

async function loadBuilderConfig() {
  const { data, error } = await supabase
    .from("discord_builder_configs")
    .select("template,theme,safe_mode")
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) {
    return { template: fallbackTemplate, theme: fallbackTheme, safe_mode: true };
  }

  const template = data.template?.categories?.length ? data.template : fallbackTemplate;
  const theme = data.theme && Object.keys(data.theme).length ? data.theme : fallbackTheme;
  return { template, theme, safe_mode: data.safe_mode === true };
}

function countChannels(template) {
  return (template.categories || []).reduce((total, category) => total + (category.channels || []).length, 0);
}

function previewEmbed(builderConfig) {
  const template = builderConfig.template;
  const theme = builderConfig.theme;
  return new EmbedBuilder()
    .setColor(theme.primary || "#0000FF")
    .setTitle("🔵 CRAZZY PROJECT • SERVER BUILDER")
    .setDescription([
      "**SAFE MODE ABSOLUTO**",
      "O Bot Core apenas cria o que estiver faltando.",
      "",
      "Categorias do template: **" + (template.categories || []).length + "**",
      "Canais do template: **" + countChannels(template) + "**",
      "",
      "Não apaga, renomeia, move, reposiciona ou altera permissões de canais/categorias existentes.",
    ].join("\n"))
    .setFooter({ text: theme.footer || "CRAZZY PROJECT • BOT CORE" });
}

function channelSnapshot(guild) {
  return new Map(
    guild.channels.cache.map((channel) => [
      channel.id,
      {
        id: channel.id,
        name: channel.name,
        parentId: channel.parentId || null,
        rawPosition: channel.rawPosition,
      },
    ])
  );
}

function assertExistingChannelsUntouched(before, guild) {
  for (const [id, previous] of before.entries()) {
    const current = guild.channels.cache.get(id);
    if (!current) throw new Error("SAFE_MODE_EXISTING_RESOURCE_MISSING");
    if (current.name !== previous.name) throw new Error("SAFE_MODE_EXISTING_NAME_CHANGED");
    if ((current.parentId || null) !== previous.parentId) throw new Error("SAFE_MODE_EXISTING_PARENT_CHANGED");
    if (current.rawPosition !== previous.rawPosition) throw new Error("SAFE_MODE_EXISTING_POSITION_CHANGED");
  }
}

async function ensureCategory(guild, name) {
  let category = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && normalize(channel.name) === normalize(name)
  );
  if (!category) {
    category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      reason: "CRAZZY PROJECT Bot Core • SAFE MODE • categoria nova",
    });
    return { category, created: true };
  }
  return { category, created: false };
}

async function ensureTextChannel(guild, category, spec) {
  let channel = guild.channels.cache.find(
    (item) =>
      item.parentId === category.id &&
      item.type === ChannelType.GuildText &&
      normalize(item.name) === normalize(spec.name)
  );
  if (channel) return { channel, created: false };

  const permissionOverwrites = spec.readOnly
    ? [{
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        deny: [PermissionFlagsBits.SendMessages],
      }]
    : [];

  channel = await guild.channels.create({
    name: spec.name,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites,
    reason: "CRAZZY PROJECT Bot Core • SAFE MODE • canal novo",
  });
  return { channel, created: true };
}

async function ensureThemeRoles(guild, theme) {
  const roles = [
    { name: "🔵 CRAZZY BLUE", color: theme.primary || "#0000FF" },
    { name: "💎 CRAZZY PROJECT", color: theme.secondary || "#1687FF" },
  ];
  for (const spec of roles) {
    if (!guild.roles.cache.some((role) => role.name === spec.name)) {
      await guild.roles.create({
        name: spec.name,
        color: spec.color,
        reason: "CRAZZY PROJECT Bot Core • role visual",
      });
    }
  }
}

export async function inspectServerDiff(guild, templateOverride = null) {
  const builderConfig = templateOverride ? { template: templateOverride } : await loadBuilderConfig();
  const template = builderConfig.template || fallbackTemplate;
  await guild.channels.fetch();
  const missing = [];

  for (const categorySpec of template.categories || []) {
    const category = guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildCategory && normalize(channel.name) === normalize(categorySpec.name)
    );

    if (!category) {
      missing.push({ type: "category", name: categorySpec.name, channels: (categorySpec.channels || []).length });
      for (const channelSpec of categorySpec.channels || []) {
        missing.push({ type: "channel", name: channelSpec.name, category: categorySpec.name });
      }
      continue;
    }

    for (const channelSpec of categorySpec.channels || []) {
      const exists = guild.channels.cache.some(
        (channel) =>
          channel.parentId === category.id &&
          channel.type === ChannelType.GuildText &&
          normalize(channel.name) === normalize(channelSpec.name)
      );
      if (!exists) missing.push({ type: "channel", name: channelSpec.name, category: categorySpec.name });
    }
  }

  return missing;
}

export async function buildServer(guild, builderConfig = null) {
  const currentConfig = builderConfig || await loadBuilderConfig();
  const template = currentConfig.template || fallbackTemplate;
  const theme = currentConfig.theme || fallbackTheme;

  if (currentConfig.safe_mode !== true || !localSafety.safeMode || localSafety.behavior !== "append_only") {
    throw new Error("SAFE_MODE_REQUIRED");
  }

  await guild.channels.fetch();
  const before = channelSnapshot(guild);
  const report = [];

  await ensureThemeRoles(guild, theme);

  for (const categorySpec of template.categories || []) {
    const categoryResult = await ensureCategory(guild, categorySpec.name);
    report.push({
      kind: "category",
      name: categoryResult.category.name,
      created: categoryResult.created,
    });

    for (const channelSpec of categorySpec.channels || []) {
      const result = await ensureTextChannel(guild, categoryResult.category, channelSpec);
      report.push({
        kind: "channel",
        name: result.channel.name,
        category: categoryResult.category.name,
        created: result.created,
      });
    }
  }

  await guild.channels.fetch();
  assertExistingChannelsUntouched(before, guild);
  return report;
}

async function queueBuilderJob(guildId) {
  const { data, error } = await supabase
    .from("discord_builder_jobs")
    .insert({
      guild_id: guildId || config.guildId || null,
      status: "queued",
      safe_mode: true,
    })
    .select("id,status")
    .single();
  if (error) throw error;
  return data;
}

export async function handleBuilderInteraction(interaction) {
  if (interaction.isChatInputCommand() && interaction.commandName === "preview-tema") {
    if (!interaction.guild) {
      await interaction.reply({ content: "❌ Use dentro de um servidor.", ephemeral: true });
      return true;
    }

    const builderConfig = await loadBuilderConfig();
    const diff = await inspectServerDiff(interaction.guild, builderConfig.template);
    const sample = diff.slice(0, 12).map((item) => item.type === "category" ? "📁 " + item.name : "# " + item.name).join("\n");
    const embed = previewEmbed(builderConfig).addFields({
      name: "O que falta hoje",
      value: diff.length ? "**" + diff.length + "** item(ns) seriam criados.\n\n" + (sample || "—") : "✅ A estrutura do template já está completa.",
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "montar-servidor") {
    if (!interaction.guild) {
      await interaction.reply({ content: "❌ Use dentro de um servidor.", ephemeral: true });
      return true;
    }
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: "❌ Preciso da permissão **Gerenciar Canais**.", ephemeral: true });
      return true;
    }

    const builderConfig = await loadBuilderConfig();
    const diff = await inspectServerDiff(interaction.guild, builderConfig.template);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("builder:confirm:" + interaction.user.id)
        .setLabel("COLOCAR " + diff.length + " ITEM(NS) NA FILA")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("builder:cancel:" + interaction.user.id)
        .setLabel("CANCELAR")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [previewEmbed(builderConfig)],
      content: diff.length ? "Serão criados **" + diff.length + "** item(ns). Nada existente será alterado." : "✅ Nada para criar.",
      components: diff.length ? [row] : [],
      ephemeral: true,
    });
    return true;
  }

  if (!interaction.isButton() || !interaction.customId.startsWith("builder:")) return false;
  const [, action, owner] = interaction.customId.split(":");
  if (interaction.user.id !== owner) {
    await interaction.reply({ content: "❌ Esse botão não é seu.", ephemeral: true });
    return true;
  }

  if (action === "cancel") {
    await interaction.update({ content: "❌ Cancelado. Nenhuma alteração foi feita.", embeds: [], components: [] });
    return true;
  }

  if (action === "confirm") {
    try {
      const job = await queueBuilderJob(interaction.guildId);
      await interaction.update({
        content: "✅ Server Builder colocado na fila do Bot Core. Job: " + job.id + "\nAcompanhe pelo painel Discord do CRAZZY PROJECT.",
        embeds: [],
        components: [],
      });
    } catch (error) {
      console.error("[builder-command]", error);
      await interaction.update({
        content: "❌ Não foi possível colocar o Server Builder na fila.",
        embeds: [],
        components: [],
      });
    }
    return true;
  }

  return false;
}

let builderBusy = false;
export async function pollBuilderQueue(client) {
  if (builderBusy || !client.isReady()) return;
  builderBusy = true;

  let claimed = null;
  try {
    const { data, error } = await supabase.rpc("claim_discord_builder_job", { p_worker_id: config.workerId });
    if (error) throw error;
    if (!data?.job) return;
    claimed = data;

    const job = data.job;
    const builderConfig = data.config || {};
    const guildId = job.guild_id || config.guildId;
    if (!guildId) throw new Error("GUILD_ID_REQUIRED");
    if (builderConfig.safe_mode !== true) throw new Error("SAFE_MODE_REQUIRED");

    const guild = await client.guilds.fetch(guildId);
    const planned = await inspectServerDiff(guild, builderConfig.template || fallbackTemplate);

    const { data: jobState } = await supabase
      .from("discord_builder_jobs")
      .select("cancel_requested")
      .eq("id", job.id)
      .single();

    if (jobState?.cancel_requested) {
      await supabase.rpc("finish_discord_builder_job", {
        p_job_id: job.id,
        p_worker_id: config.workerId,
        p_status: "cancelled",
        p_planned_items: planned,
        p_report: [],
        p_created_count: 0,
        p_preserved_count: 0,
        p_last_error: null,
      });
      return;
    }

    const report = await buildServer(guild, {
      template: builderConfig.template || fallbackTemplate,
      theme: builderConfig.theme || fallbackTheme,
      safe_mode: true,
    });
    const created = report.filter((item) => item.created).length;
    const preserved = report.length - created;

    await supabase.rpc("finish_discord_builder_job", {
      p_job_id: job.id,
      p_worker_id: config.workerId,
      p_status: "completed",
      p_planned_items: planned,
      p_report: report,
      p_created_count: created,
      p_preserved_count: preserved,
      p_last_error: null,
    });
  } catch (error) {
    console.error("[builder-worker]", error);
    if (claimed?.job?.id) {
      await supabase.rpc("finish_discord_builder_job", {
        p_job_id: claimed.job.id,
        p_worker_id: config.workerId,
        p_status: "failed",
        p_planned_items: [],
        p_report: [],
        p_created_count: 0,
        p_preserved_count: 0,
        p_last_error: String(error?.message || "BUILDER_FAILED").slice(0, 1000),
      });
    }
  } finally {
    builderBusy = false;
  }
}