import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

export function commandDefinitions() {
  const predef = new SlashCommandBuilder()
    .setName("predef")
    .setDescription("Gerencia templates de campanha CRAZZY PROJECT")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sc) =>
      sc.setName("save")
        .setDescription("Salva a embed atual como template")
        .addStringOption((o) =>
          o.setName("name").setDescription("Nome do template").setRequired(true)
        )
    )
    .addSubcommand((sc) => sc.setName("list").setDescription("Lista templates"))
    .addSubcommand((sc) =>
      sc.setName("remove")
        .setDescription("Remove um template")
        .addStringOption((o) =>
          o.setName("name").setDescription("Nome do template").setRequired(true)
        )
    )
    .addSubcommand((sc) =>
      sc.setName("preview")
        .setDescription("Mostra a prévia de um template")
        .addStringOption((o) =>
          o.setName("name").setDescription("Nome do template").setRequired(true)
        )
    )
    .addSubcommand((sc) =>
      sc.setName("send")
        .setDescription("Coloca um template na fila de envio")
        .addStringOption((o) =>
          o.setName("name").setDescription("Nome do template").setRequired(true)
        )
        .addBooleanOption((o) =>
          o.setName("only_online").setDescription("Somente online/idle/dnd")
        )
    );

  return [
    new SlashCommandBuilder()
      .setName("disparar")
      .setDescription("Abre o editor rápido de campanha para todos")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
      .setName("dispararonline")
      .setDescription("Abre o editor rápido para membros online")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    predef,
    new SlashCommandBuilder()
      .setName("preview-tema")
      .setDescription("Mostra a prévia do template do servidor")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
      .setName("montar-servidor")
      .setDescription("Cria apenas a estrutura que estiver faltando em SAFE MODE")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ].map((command) => command.toJSON());
}
