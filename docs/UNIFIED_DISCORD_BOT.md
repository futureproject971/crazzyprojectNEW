# CRAZZY PROJECT — UNIFIED DISCORD BOT

## Regra

Existe apenas **um bot Discord oficial CRAZZY PROJECT**.

- 1 Discord application
- 1 bot token
- 1 processo na Discloud
- 1 conexão com o Discord Gateway
- vários módulos internos

Nunca hospedar um bot separado por função.

## Arquitetura

CRAZZY PROJECT (site/admin)
  → Supabase (fila / estado / logs)
  → CRAZZY DISCORD BOT CORE (Discloud)
  → Discord Gateway / REST

## Módulos

### campaigns
- /disparar
- /dispararonline
- /predef
- templates centralizados
- all / online / role / single
- teste para o administrador
- agendamento
- cancelamento
- progresso
- histórico

### roles
- grant/revoke de cargos
- product/entitlement → role
- retry/reconcile
- prioridade/cor

### notify
- compra aprovada
- entrega concluída
- tutorial liberado
- pagamento pendente
- falhas que exigem suporte

### support
- integração com tickets
- notificações de ticket
- comandos administrativos de suporte

### security
- alertas do Security Sentinel
- deduplicação/cooldown
- sem secrets nos alertas

## Segredos

Somente no ambiente da Discloud:

DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRAZZY_DISCORD_WORKER_ID=main

Nunca usar NEXT_PUBLIC_ para token do bot ou service role.

## Compatibilidade com o bot antigo

Os slash commands antigos continuam existindo, mas não executam um sistema paralelo.

- /disparar → campanha all
- /dispararonline → campanha online
- /predef → templates do Supabase
- o envio final entra na mesma fila usada pelo site

O arquivo local templates.json deixa de ser a fonte de verdade.

## Campaign Center do site

Rota: /admin/campanhas

Inclui:
- editor;
- preview estilo Discord em tempo real;
- templates;
- duplicar template;
- imagem + thumbnail;
- título + descrição;
- botão/link;
- footer;
- cor;
- público;
- cargos recebidos do worker;
- estimativa de destinatários;
- teste para minha DM;
- agendamento;
- fila;
- progresso;
- sucesso/falha/pulados;
- cancelamento;
- histórico;
- status do worker.

## Community + CALL

A Comunidade deve oferecer no mesmo ecossistema:
- canais de texto;
- lista de pessoas;
- CRAZZY CALL;
- voz;
- câmera;
- screen share;
- múltiplas transmissões;
- PiP real;
- moderação da sala.

/call continua como central/acesso direto.
