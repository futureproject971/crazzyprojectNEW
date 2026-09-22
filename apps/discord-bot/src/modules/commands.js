import {
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { handleBuilderInteraction } from "./server-builder.js";
import {
  buildCampaignComponents,
  buildCampaignEmbed,
  getTemplateByName,
  listTemplates,
  queueTemplateCampaign,
} from "./campaigns.js";

function definitions() {
  const manage = PermissionFlagsBits.ManageGuild;

  return [
    new SlashCommandBuilder()
      .setName("disparar")
      .setDescription("Envia uma campanha para todos os membros")
      .setDefaultMemberPermissions(manage)
      .addStringOption((option) =>
        option.setName("template").setDescription("Nome do template salvo no CRAZZY PROJECT").setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("dispararonline")
      .setDescription("Envia uma campanha somente para membros online")
      .setDefaultMemberPermissions(manage)
      .addStringOption((option) =>
        option.setName("template").setDescription("Nome do template salvo no CRAZZY PROJECT").setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("preview-tema")
      .setDescription("Mostra o preview do Server Builder SAFE MODE")
      .setDefaultMemberPermissions(manage),
    new SlashCommandBuilder()
      .setName("montar-servidor")
      .setDescription("Cria somente a estrutura que estiver faltando")
      .setDefaultMemberPermissions(manage),
    new SlashCommandBuilder()
      .setName("predef")
      .setDescription("Gerencia templates do Campaign Center")
      .setDefaultMemberPermissions(manage)
      .addSubcommand((sub) => sub.setName("list").setDescription("Lista templates salvos"))
      .addSubcommand((sub) =>
        sub.setName("preview").setDescription("Mostra a prévia de um template")
          .addStringOption((option) => option.setName("name").setDescription("Nome").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub.setName("send").setDescription("Coloca um template na fila de envio")
          .addStringOption((option) => option.setName("name").setDescription("Nome").setRequired(true))
          .addBooleanOption((option) => option.setName("only_online").setDescription("Somente membros online?"))
      )
      .addSubcommand((sub) =>
        sub.setName("save").setDescription("Salva ou atualiza um template simples")
          .addStringOption((option) => option.setName("name").setDescription("Nome").setRequired(true))
          .addStringOption((option) => option.setName("title").setDescription("Título").setRequired(false))
          .addStringOption((option) => option.setName("description").setDescription("Descrição").setRequired(false))
          .addStringOption((option) => option.setName("image").setDescription("URL da imagem").setRequired(false))
          .addStringOption((option) => option.setName("link").setDescription("URL do botão").setRequired(false))
          .addStringOption((option) => option.setName("color").setDescription("Cor hexadecimal, ex: #1687FF").setRequired(false))
      )
      .addSubcommand((sub) =>
        sub.setName("remove").setDescription("Remove um template")
          .addStringOption((option) => option.setName("name").setDescription("Nome").setRequired(true))
      ),
  ].map((command) => command.toJSON());
}

function parseColor(value) {
  const text = String(value || "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(text)) return 0x1687ff;
  return Number.parseInt(text.slice(1), 16);
}

function hasAdminAccess(interaction, config) {
  if (!interaction.inGuild()) return false;
  if (config.adminUserIds.has(interaction.user.id)) return true;

  const memberRoles = interaction.member?.roles?.cache;
  if (memberRoles && [...config.adminRoleIds].some((roleId) => memberRoles.has(roleId))) {
    return true;
  }

  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

function editorUrl(config) {
  if (!config.siteUrl) return null;
  return config.siteUrl.replace(/\/$/, "") + "/admin/campanhas";
}

async function queueNamedTemplate(interaction, supabase, config, targetMode) {
  const name = interaction.options.getString("template")?.trim();

  if (!name) {
    const url = editorUrl(config);
    return interaction.reply({
      ephemeral: true,
      content: url
        ? "🎛️ Monte a campanha no Campaign Center: " + url
        : "🎛️ Abra o Campaign Center do CRAZZY PROJECT e monte a campanha por lá.",
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const template = await getTemplateByName(supabase, name);
  if (!template) {
    return interaction.editReply("❌ Template **" + name + "** não encontrado.");
  }

  const campaign = await queueTemplateCampaign({
    supabase,
    template,
    guildId: interaction.guildId || config.guildId,
    targetMode,
  });

  return interaction.editReply(
    "✅ Campanha **" + template.name + "** colocada na fila. ID: " + campaign.id
  );
}

export async function deployCommands(config) {
  const rest = new REST({ version: "10" }).setToken(config.token);
  const route = Routes.applicationGuildCommands(config.clientId, config.guildId);
  await rest.put(route, { body: definitions() });
  console.log("[commands] slash commands registered");
}

export function installCommandHandlers(client, supabase, config) {
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isButton() && interaction.customId.startsWith("builder:")) {
        return handleBuilderInteraction(interaction, supabase, config);
      }

      if (!interaction.isChatInputCommand()) return;

      if (!hasAdminAccess(interaction, config)) {
        return interaction.reply({
          ephemeral: true,
          content: "❌ Você não tem permissão para usar este comando.",
        });
      }

      if (["preview-tema", "montar-servidor"].includes(interaction.commandName)) {
        return handleBuilderInteraction(interaction, supabase, config);
      }

      if (interaction.commandName === "disparar") {
        return queueNamedTemplate(interaction, supabase, config, "all");
      }

      if (interaction.commandName === "dispararonline") {
        return queueNamedTemplate(interaction, supabase, config, "online");
      }

      if (interaction.commandName !== "predef") return;
      const sub = interaction.options.getSubcommand();

      if (sub === "list") {
        const templates = await listTemplates(supabase);
        if (!templates.length) {
          return interaction.reply({ ephemeral: true, content: "📂 Nenhum template salvo." });
        }

        return interaction.reply({
          ephemeral: true,
          content: "📂 Templates:\n" + templates.slice(0, 50).map((item) => "• " + item.name).join("\n"),
        });
      }

      if (sub === "preview") {
        const name = interaction.options.getString("name", true);
        const template = await getTemplateByName(supabase, name);

        if (!template) {
          return interaction.reply({ ephemeral: true, content: "❌ Template **" + name + "** não encontrado." });
        }

        return interaction.reply({
          ephemeral: true,
          embeds: [buildCampaignEmbed(template)],
          components: buildCampaignComponents(template),
        });
      }

      if (sub === "send") {
        const name = interaction.options.getString("name", true);
        const onlyOnline = interaction.options.getBoolean("only_online") ?? false;
        const template = await getTemplateByName(supabase, name);

        if (!template) {
          return interaction.reply({ ephemeral: true, content: "❌ Template **" + name + "** não encontrado." });
        }

        const campaign = await queueTemplateCampaign({
          supabase,
          template,
          guildId: interaction.guildId || config.guildId,
          targetMode: onlyOnline ? "online" : "all",
        });

        return interaction.reply({
          ephemeral: true,
          content: "✅ Template **" + template.name + "** colocado na fila. ID: " + campaign.id,
        });
      }

      if (sub === "save") {
        const name = interaction.options.getString("name", true).trim();
        const title = interaction.options.getString("title");
        const description = interaction.options.getString("description") || "";
        const image = interaction.options.getString("image");
        const link = interaction.options.getString("link");
        const color = parseColor(interaction.options.getString("color"));

        const { data, error } = await supabase
          .from("discord_campaign_templates")
          .upsert(
            {
              name,
              title: title || null,
              description,
              image_url: image || null,
              link_url: link || null,
              button_label: "🛒 Acessar Loja",
              footer_text: "CRAZZY PROJECT",
              color,
              active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "name" }
          )
          .select()
          .single();

        if (error || !data) throw error || new Error("TEMPLATE_SAVE_FAILED");

        return interaction.reply({
          ephemeral: true,
          content: "✅ Template **" + name + "** salvo no Supabase.",
        });
      }

      if (sub === "remove") {
        const name = interaction.options.getString("name", true).trim();
        const { error } = await supabase
          .from("discord_campaign_templates")
          .delete()
          .ilike("name", name);

        if (error) throw error;

        return interaction.reply({
          ephemeral: true,
          content: "🗑️ Template **" + name + "** removido.",
        });
      }
    } catch (error) {
      console.error("[commands] interaction error:", error);
      const content = "❌ Ocorreu um erro. Verifique o Campaign Center e os logs do bot.";

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(content).catch(() => undefined);
      }

      return interaction.reply({ ephemeral: true, content }).catch(() => undefined);
    }
  });
}
