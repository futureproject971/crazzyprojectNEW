import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { readFileSync } from "node:fs";

const readJson = (relative) =>
  JSON.parse(readFileSync(new URL(relative, import.meta.url), "utf8"));

const template = readJson("../../config/server-template.json");
const theme = readJson("../../config/theme.json");
const safety = readJson("../../config/safety.json");

const normalize = (value) => String(value || "").trim().toLowerCase();

function countChannels() {
  return template.categories.reduce((total, category) => total + category.channels.length, 0);
}

function previewEmbed() {
  return new EmbedBuilder()
    .setColor(theme.primary)
    .setTitle("🔵 CRAZZY PROJECT • SERVER BUILDER")
    .setDescription(
      [
        "**SAFE MODE ABSOLUTO**",
        "O bot apenas cria o que estiver faltando.",
        "",
        `Categorias do template: **${template.categories.length}**`,
        `Canais do template: **${countChannels()}**`,
        "",
        "Não apaga, renomeia, move, reposiciona ou altera permissões de canais/categorias existentes.",
      ].join("\n")
    )
    .setFooter({ text: theme.footer });
}

async function ensureCategory(guild, name, position) {
  let category = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildCategory &&
      normalize(channel.name) === normalize(name)
  );

  if (!category) {
    category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      position,
      reason: "CRAZZY PROJECT Bot Core • SAFE MODE • categoria nova",
    });
  }

  return category;
}

async function ensureTextChannel(guild, category, spec, position) {
  let channel = guild.channels.cache.find(
    (item) =>
      item.parentId === category.id &&
      item.type === ChannelType.GuildText &&
      normalize(item.name) === normalize(spec.name)
  );

  if (channel) return { channel, created: false };

  const permissionOverwrites = spec.readOnly
    ? [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages],
        },
      ]
    : [];

  channel = await guild.channels.create({
    name: spec.name,
    type: ChannelType.GuildText,
    parent: category.id,
    position,
    permissionOverwrites,
    reason: "CRAZZY PROJECT Bot Core • SAFE MODE • canal novo",
  });

  return { channel, created: true };
}

async function ensureThemeRoles(guild) {
  const roles = [
    { name: "🔵 CRAZZY BLUE", color: theme.primary },
    { name: "💎 CRAZZY PROJECT", color: theme.secondary },
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

export async function inspectServerDiff(guild) {
  await guild.channels.fetch();
  const missing = [];

  for (const categorySpec of template.categories) {
    const category = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildCategory &&
        normalize(channel.name) === normalize(categorySpec.name)
    );

    if (!category) {
      missing.push({
        type: "category",
        name: categorySpec.name,
        channels: categorySpec.channels.length,
      });
      continue;
    }

    for (const channelSpec of categorySpec.channels) {
      const exists = guild.channels.cache.some(
        (channel) =>
          channel.parentId === category.id &&
          channel.type === ChannelType.GuildText &&
          normalize(channel.name) === normalize(channelSpec.name)
      );
      if (!exists) {
        missing.push({
          type: "channel",
          name: channelSpec.name,
          category: categorySpec.name,
        });
      }
    }
  }

  return missing;
}

export async function buildServer(guild) {
  if (!safety.safeMode || safety.behavior !== "append_only") {
    throw new Error("SAFE_MODE_REQUIRED");
  }

  await guild.channels.fetch();
  const protectedIds = new Set(guild.channels.cache.map((channel) => channel.id));
  const report = [];

  await ensureThemeRoles(guild);

  let categoryPosition = 0;
  for (const categorySpec of template.categories) {
    const existing = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildCategory &&
        normalize(channel.name) === normalize(categorySpec.name)
    );
    const category = await ensureCategory(guild, categorySpec.name, categoryPosition++);

    report.push({
      kind: "category",
      name: category.name,
      created: !existing,
    });

    let channelPosition = 0;
    for (const channelSpec of categorySpec.channels) {
      const result = await ensureTextChannel(
        guild,
        category,
        channelSpec,
        channelPosition++
      );
      report.push({
        kind: "channel",
        name: result.channel.name,
        category: category.name,
        created: result.created,
      });
    }
  }

  await guild.channels.fetch();
  const missingProtected = [...protectedIds].filter((id) => !guild.channels.cache.has(id));
  if (missingProtected.length) {
    throw new Error("SAFE_MODE_EXISTING_RESOURCE_MISSING");
  }

  return report;
}

export async function handleBuilderInteraction(interaction) {
  if (interaction.isChatInputCommand() && interaction.commandName === "preview-tema") {
    if (!interaction.guild) {
      await interaction.reply({ content: "❌ Use dentro de um servidor.", ephemeral: true });
      return true;
    }

    const diff = await inspectServerDiff(interaction.guild);
    const sample = diff
      .slice(0, 12)
      .map((item) =>
        item.type === "category"
          ? `📁 ${item.name} (+ ${item.channels} canal/is)`
          : `# ${item.name}`
      )
      .join("\n");

    const embed = previewEmbed().addFields({
      name: "O que falta hoje",
      value: diff.length
        ? `**${diff.length}** item(ns) seriam criados.\n\n${sample || "—"}`
        : "✅ A estrutura do template já está completa.",
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
      await interaction.reply({
        content: "❌ Preciso da permissão **Gerenciar Canais**.",
        ephemeral: true,
      });
      return true;
    }

    const diff = await inspectServerDiff(interaction.guild);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`builder:confirm:${interaction.user.id}`)
        .setLabel(`CRIAR ${diff.length} ITEM(NS)`)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`builder:cancel:${interaction.user.id}`)
        .setLabel("CANCELAR")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [previewEmbed()],
      content: diff.length
        ? `Serão criados **${diff.length}** item(ns). Nada existente será alterado.`
        : "✅ Nada para criar.",
      components: diff.length ? [row] : [],
      ephemeral: true,
    });
    return true;
  }

  if (!interaction.isButton() || !interaction.customId.startsWith("builder:")) {
    return false;
  }

  const [, action, owner] = interaction.customId.split(":");
  if (interaction.user.id !== owner) {
    await interaction.reply({ content: "❌ Esse botão não é seu.", ephemeral: true });
    return true;
  }

  if (action === "cancel") {
    await interaction.update({
      content: "❌ Cancelado. Nenhuma alteração foi feita.",
      embeds: [],
      components: [],
    });
    return true;
  }

  if (action === "confirm") {
    await interaction.update({
      content: "⚙️ Criando apenas o que estiver faltando...",
      embeds: [],
      components: [],
    });

    try {
      const report = await buildServer(interaction.guild);
      const created = report.filter((item) => item.created);
      const embed = new EmbedBuilder()
        .setColor(theme.secondary)
        .setTitle("✅ CRAZZY PROJECT • SAFE MODE CONCLUÍDO")
        .setDescription(
          [
            `Criados: **${created.length}**`,
            `Preservados/reutilizados: **${report.length - created.length}**`,
            "",
            created
              .slice(0, 25)
              .map((item) => (item.kind === "channel" ? `# ${item.name}` : `📁 ${item.name}`))
              .join("\n") || "Nenhuma criação necessária.",
          ].join("\n")
        )
        .setFooter({ text: theme.footer });

      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error("[builder]", error);
      await interaction.followUp({
        content: `❌ Falha no SAFE MODE: \`${error?.message || "UNKNOWN"}\``,
        ephemeral: true,
      });
    }
    return true;
  }

  return false;
}
