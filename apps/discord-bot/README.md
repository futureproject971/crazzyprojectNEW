# CRAZZY PROJECT Discord Bot

Bot oficial único do **CRAZZY PROJECT**.

## Regra de infraestrutura

Use **um único Discord application/client, um único bot token e um único processo na Discloud**.

Todos os sistemas Discord entram como módulos em `src/modules`. Não crie bots separados para Campaigns, Bridge, Notify ou Security.

## Módulos ativos no mesmo Bot Core

### Campaigns / DM

- `/disparar`
- `/dispararonline`
- `/predef`
- fila do site
- templates Supabase
- heartbeat para o Campaign Center
- progresso / cancelamento / histórico

### Server Builder

- `/preview-tema`
- `/montar-servidor`
- painel `/admin/discord`
- template e tema compartilhados pelo Supabase
- fila e histórico
- SAFE MODE append-only
- não apaga, renomeia, move, reposiciona ou altera permissões de recursos existentes

### Discord Bridge

- fila de grant/revoke de cargos
- retry
- entitlement do site continua sendo a fonte de direitos
- cargo Discord manual não concede produto pago

### Notify

- fila de notificações Discord
- DM opcional para notificações do site
- pacing configurável

### Security Sentinel

- entrega alertas no canal privado configurado
- `CRITICAL` pode mencionar somente o cargo de segurança configurado
- falha do Discord não derruba checkout, auth ou fulfillment

## Validação antes de iniciar

`npm start` executa automaticamente `npm run check` primeiro.

O check cobre:
- Bot Core
- configuração
- cliente Supabase
- Campaigns
- Commands
- Server Builder
- Role Bridge
- Notify
- Security Sentinel

Se qualquer arquivo tiver erro de sintaxe, a aplicação não inicia com código quebrado.

## Variáveis da aplicação Discloud

Configure os valores de produção diretamente nas variáveis de ambiente da aplicação. **Não envie um arquivo `.env` com segredos.**

Obrigatórias:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Configuração:

- `CRAZZY_DISCORD_WORKER_ID=main`
- `CRAZZY_SITE_URL=https://SEU-SITE.com`
- `DISCORD_DM_DELAY_MS=1500`

Opcionais:

- `DISCORD_ADMIN_USER_IDS`
- `DISCORD_ADMIN_ROLE_IDS`

O token Discord e a Supabase service role são **somente server-side**.

## Deploy correto na Discloud

A aplicação a enviar é **esta pasta `apps/discord-bot`**, não o monorepo inteiro.

Quando essa pasta é usada como raiz do pacote, a estrutura fica:

```text
discord-bot/
├── discloud.config
├── package.json
├── .discloudignore
├── src/
└── config/
```

Config atual:

- `TYPE=bot`
- `MAIN=src/index.js`
- `START=npm start`
- `RAM=512`
- `VERSION=latest`
- `AUTORESTART=true`

### Upload manual / CLI

Compacte **o conteúdo** de `apps/discord-bot` de forma que `discloud.config` fique na raiz do ZIP.

Também é possível entrar nessa pasta e usar a CLI da Discloud:

```bash
cd apps/discord-bot
npm run check
discloud up
```

### Integração GitHub da Discloud

O repositório agora também possui um `discloud.config` na raiz para deploy direto pela integração GitHub da Discloud.

Esse arquivo raiz aponta para:

- `MAIN=apps/discord-bot/src/index.js`
- `BUILD=npm --prefix apps/discord-bot install --omit=dev`
- `START=npm --prefix apps/discord-bot start`
- `RAM=512`
- `VERSION=latest`
- `AUTORESTART=true`

Assim, você pode usar tanto o upload/CLI da pasta `apps/discord-bot` quanto o deploy GitHub do monorepo, sem mover o Bot Core e sem colocar segredos no repositório.

## Sinal de saúde esperado

Após iniciar corretamente, o Bot Core deve gravar heartbeat em `discord_campaign_worker_status`.

O painel `/admin/integracoes` deve mudar o Bot Core para online, e `/admin/discord-bridge` passa a mostrar o worker ativo.

Se não houver heartbeat, trate o bot como **offline**, mesmo que o processo apareça como iniciado na hospedagem.

## Segurança

- nunca commitar `.env`;
- nunca expor service role no site;
- nunca enviar token Discord ao navegador;
- nunca logar secrets, keys de produto ou conteúdo entregue;
- use somente a guild configurada;
- Security Sentinel usa canal/cargo configurados no Supabase, sem hardcode;
- roles pagas são solicitadas pelo Fulfillment/Bridge, não por comandos manuais de produto.

## Templates legados

Se ainda existir um `templates.json` antigo:

1. coloque temporariamente o arquivo na pasta do bot;
2. execute `npm run import-legacy-templates -- templates.json`;
3. confirme os templates no Campaign Center;
4. remova o arquivo local.

Depois disso o Supabase é a fonte de verdade.
