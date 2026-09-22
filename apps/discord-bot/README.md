# CRAZZY PROJECT Discord Bot

Bot oficial único do CRAZZY PROJECT.

## Regra

Use **um único Discord bot token** e **um único processo na Discloud**.

Novos sistemas Discord entram como módulos em `src/modules`. Não crie outro bot.

## Módulos já migrados

### Campanhas/DM

- Campanhas/DM
- /disparar
- /dispararonline
- /predef
- fila do site
- templates Supabase
- heartbeat para o Campaign Center
- progresso/cancelamento/histórico

### Server Builder

- /preview-tema
- /montar-servidor
- painel /admin/discord
- template e tema compartilhados pelo Supabase
- fila e histórico de execução
- SAFE MODE append-only
- não apaga, renomeia, move, reposiciona ou altera permissões de canal/categoria existente
- cria apenas recursos que estiverem faltando

## Variáveis Discloud

Copie `.env.example` e configure no ambiente da aplicação:

- DISCORD_BOT_TOKEN
- DISCORD_CLIENT_ID
- DISCORD_GUILD_ID
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- CRAZZY_DISCORD_WORKER_ID
- CRAZZY_SITE_URL

O token do Discord e a service role nunca devem ficar no frontend/site.

## Migrar templates do bot antigo

Se você ainda possui o `templates.json` antigo:

1. coloque temporariamente o arquivo na pasta do bot;
2. execute:
   `npm run import-legacy-templates -- templates.json`
3. confirme os templates no Campaign Center;
4. remova o arquivo local.

Depois disso o Supabase passa a ser a fonte de verdade.

## Deploy Discloud

A pasta `apps/discord-bot` é uma aplicação independente para deploy na Discloud.

- main: `src/index.js`
- autorestart: ligado
- Node 22+
- RAM inicial: 384 MB

## Próximos módulos do mesmo bot

- roles / Discord Bridge
- notify
- support
- security alerts
- demais slash commands

Todos usarão o mesmo client Discord já conectado.
