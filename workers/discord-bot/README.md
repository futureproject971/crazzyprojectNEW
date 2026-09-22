# CRAZZY PROJECT • DISCORD BOT CORE

Um único worker Discord para o ecossistema CRAZZY PROJECT.

## Regra
- 1 Discord application
- 1 token
- 1 conexão Gateway
- 1 deploy Discloud
- vários módulos internos

## Módulos já incorporados

### Campaigns / DM
Substitui o antigo bot de divulgação separado.

Commands:
- /disparar
- /dispararonline
- /predef save
- /predef list
- /predef remove
- /predef preview
- /predef send

Templates agora usam Supabase, a mesma base do painel /admin/campanhas.

O envio em massa é processado por fila persistente. Se o processo reiniciar, o site continua preservando o estado da campanha.

### Server Builder
Substitui o CRAZZY PROJECT SERVER BUILDER separado.

Commands:
- /preview-tema
- /montar-servidor

SAFE MODE:
- append-only
- não apaga canal/categoria existente
- não renomeia
- não move
- não reposiciona
- não altera permissões de recursos existentes
- cria somente o que falta

## Variáveis Discloud

Copie .env.example e configure no ambiente seguro da Discloud.

Nunca exponha:
- DISCORD_TOKEN
- SUPABASE_SERVICE_ROLE_KEY

## Intents

No Discord Developer Portal habilite:
- Server Members Intent
- Presence Intent

## Próximos módulos do mesmo Bot Core
- Discord Bridge / roles
- Notify
- Support/Tickets
- Security Alerts

Esses módulos não devem criar outro bot/token.
