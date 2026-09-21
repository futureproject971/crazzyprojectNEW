# M14 — CRAZZY COMMUNITY — WORKER HANDOFF

Data: 2026-09-21

## REPO / BRANCH
- repo: `futureproject971/crazzyprojectNEW`
- base: `phase-1-home`
- branch: `m14-community`

## ESTADO
- M13 CRAZZY SUPPORT mergeado via PR #15
- merge commit: `da7d4ac9b052493e7b9537ca15afe616db441157`
- CI pós-merge phase-1-home: PASS
- M14 iniciado
- ainda sem schema Community aplicado neste branch

## AUDITORIA INICIAL
No banco NÃO existem tabelas de Community/chat ainda.
Encontradas apenas:
- support_messages
- ticket_messages

Essas tabelas NÃO devem ser reutilizadas para Community.

## OBJETIVO M14
Criar chat real da CRAZZY PROJECT com experiência familiar estilo Discord:
- mensagens reais;
- perfil clicável;
- avatar;
- roles CRAZZY;
- cargos Discord;
- cor do cargo principal;
- badges;
- reply;
- reações;
- sync Discord;
- imagem/vídeo/áudio quando seguro.

## REGRA DE IDENTIDADE
Reaproveitar:
- profiles
- profile_preferences
- user_roles
- discord_identities
- discord_role_grants
- entitlements

Não duplicar identidade em tabela paralela.

## COR DO NICK
Decisão D09:
- cor = maior role visível/prioritária.

Como M44 ainda não existe, M14 deve:
- usar cor segura derivada da maior role disponível;
- deixar contrato pronto para M44 fornecer prioridade/cor oficial depois;
- não permitir usuário autoescolher cor de cargo.

A cor principal do Profile M12 NÃO é automaticamente cargo/permissão.

## PERFIL CLICÁVEL
Ao clicar no usuário, mostrar snapshot seguro:
- avatar
- display name
- bio
- badges derivados
- app roles
- Discord conectado/verificado
- cargos Discord visíveis
- estatísticas públicas seguras quando apropriado

Nunca mostrar:
- email
- user_id bruto como destaque
- bans
- IP
- pagamentos
- keys
- Library secrets

## CHAT
Criar domínio separado:
- community_channels
- community_messages
- community_reactions
- community_attachments, se mídia entrar
- opcional community_message_events/moderation fields

Primeiro canal:
- geral

Arquitetura deve permitir canais futuros sem refazer schema.

## REPLIES
community_messages deve suportar:
- reply_to_message_id nullable
- mesma channel
- resposta mostra preview seguro da mensagem original

## REAÇÕES
community_reactions:
- message_id
- user_id
- emoji
- unique(message_id,user_id,emoji)

Allowlist inicial de emojis simples.
Não permitir HTML/arbitrary payload.

## MÍDIA
Se implementada no M14:
- bucket privado `community-media`
- signed upload
- signed download curto
- allowlist imagem/vídeo/áudio
- sem executáveis
- limite de tamanho
- metadata no Postgres
- browser nunca recebe service role

## MODERAÇÃO
M14 é experiência usuário.
M33 será moderação completa.

M14 pode permitir:
- usuário deletar/ocultar própria mensagem dentro de regra segura;
- backend marcar deleted_at;
- mensagem apagada mantém referência/reply sem vazar conteúdo.

Não implementar M33 inteiro.

## REALTIME
Preferência:
- Supabase Realtime privado se RLS/autorização estiver limpa.

Fallback aceitável:
- polling seguro curto.

Não sacrificar segurança por Realtime.

## RLS
Usuário autenticado:
- lê canais ativos;
- lê mensagens permitidas;
- cria mensagem como si próprio;
- não forja sender_id;
- reage como si próprio;
- não altera role/badge/cor/cargo.

Anon:
- chat Community privado por padrão neste M14.

## RATE LIMIT
Criar limites server-side para:
- envio de mensagem
- reação
- upload

Evitar spam.

## BOUNDARIES
M14:
- chat/comunidade.

M20:
- ranking.

M33:
- moderação admin avançada.

M44:
- sync/grant/revoke de Discord roles.

M47:
- eventos de segurança.

## PRÓXIMOS PASSOS EXATOS
1. Ler CHECKLIST-MASTER.
2. Ler este handoff.
3. Auditar home/static chat atual no código.
4. Auditar roles/cor disponíveis no banco.
5. Desenhar schema M14.
6. Commitar migration ANTES de aplicar.
7. Aplicar schema e RLS.
8. Criar bucket privado se mídia entrar.
9. Criar backend Community.
10. Criar UI /comunidade.
11. ligar App Shell.
12. perfil clicável.
13. reply/reactions.
14. mídia.
15. Security Advisor.
16. smoke M14.
17. npm ci / typecheck / build.
18. CI.
19. PR.
20. merge.
21. validar base.
22. iniciar M15.

## REGRA DE PERSISTÊNCIA
Cada avanço relevante deve ser commitado no Git.
Atualizar este handoff se a conversa estiver perto do limite.


## CHECKPOINT — M14 IMPLEMENTADO

Implementado e versionado:
- migration `202609211530_m14_community_core.sql` aplicada;
- community_channels;
- community_messages;
- community_reactions;
- community_attachments;
- canal `geral`;
- bucket privado `community-media`;
- Edge Function `community` v1 ativa;
- /comunidade privada;
- mensagens;
- reply;
- reações;
- soft delete própria/admin-mod;
- perfil clicável;
- avatar M12;
- app roles;
- cargos Discord já concedidos;
- badges;
- cargo principal/cor segura enquanto M44 não fornece prioridade oficial;
- imagem/vídeo/áudio privados;
- signed upload;
- signed media URL curta;
- polling 4s somente com aba visível;
- rate limits;
- App Shell aponta para /comunidade;
- Security Advisor 0 lints;
- smoke M14 versionado e adicionado ao CI;
- regra completa em `docs/M14-COMMUNITY-RULES.md`.

QA:
- primeiro CI encontrou import relativo errado no proxy de upload;
- corrigido no commit `5cf1f5e2e8a3039e8ba1dfd99e6fb0f22086d09d`;
- novo CI está rodando.

Próximo passo exato:
1. confirmar TypeScript PASS;
2. confirmar build PASS;
3. confirmar smoke M14 PASS;
4. corrigir qualquer falha;
5. atualizar checklist;
6. PR M14;
7. squash merge;
8. validar phase-1-home pós-merge;
9. iniciar M15 CRAZZY REVIEWS.


## CHECKPOINT — QA M14 VERDE

CI de código:
- run 35620568502
- npm ci PASS
- TypeScript PASS
- production build PASS
- M14 Community security smoke PASS

Smoke comprovou:
- anon bloqueado de community_channels;
- anon bloqueado de community_messages;
- anon bloqueado de community_reactions;
- anon bloqueado de community_attachments;
- snapshot Community exige auth;
- envio de mensagem exige auth;
- reação exige auth;
- bucket community-media sem acesso público;
- catálogo público continua público.

Supabase:
- Security Advisor: 0 lints;
- authenticated sem INSERT direto em messages/reactions/attachments;
- bucket public=false.

Próximo:
1. PR M14;
2. squash merge;
3. validar phase-1-home;
4. iniciar M15 CRAZZY REVIEWS.
