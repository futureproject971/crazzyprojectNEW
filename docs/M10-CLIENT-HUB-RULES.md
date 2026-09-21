# M10 — CRAZZY CLIENT HUB

Status: **concluído estruturalmente.**

## Objetivo

Painel privado do cliente com visão consolidada de:
- compras;
- pagamentos;
- produtos ativos;
- entitlements;
- tutoriais liberados;
- entregas;
- roles/cargos;
- status Discord.

O site continua público. O Client Hub exige sessão.

## Rotas

- `/painel`
- `/painel/pedidos`
- `/painel/produtos`
- `/painel/tutoriais`
- `/painel/entregas`
- `/painel/discord`
- `/api/client-hub`

Todas as rotas `/painel*` já são protegidas pelo middleware M09.

## Fonte de dados

O snapshot do cliente usa sessão Supabase e RLS do próprio usuário.

Não usa service role para leitura do painel.

Fontes:
- profiles;
- user_roles;
- discord_identities;
- payments;
- order_tickets;
- entitlements;
- discord_role_grants;
- reward_deliveries;
- products;
- product_plans.

## Entitlements

Tabela `public.entitlements`.

Estados:
- active
- expired
- revoked
- refunded
- disputed

Campos principais:
- user
- product
- plan
- source payment
- source order ticket
- fulfillment key
- starts/expires
- tutorial_access
- metadata

O cliente:
- pode SELECT apenas os próprios;
- não pode INSERT/UPDATE/DELETE.

M43 Fulfillment Engine será o escritor autoritativo.

### Tutorial após expiração normal

A regra D03/D06 continua preservada:
- entitlement pode expirar;
- tutorial_access pode permanecer true;
- refund/dispute/revoke podem ser tratados pelo M43 conforme política aprovada.

## Cargos Discord

Tabela `public.discord_role_grants`.

Estados:
- pending
- granted
- failed
- revoked

O M10 somente lê status.

M44 Discord Bridge será o escritor responsável por:
- grant;
- revoke;
- retry;
- reconcile.

## Tutoriais

O M10 mostra apenas que existe tutorial liberado.

Ele NÃO retorna:
- tutorial_text;
- tutorial_file_url;
- arquivo protegido.

O viewer real e a verificação server-side do conteúdo entram no M22 CRAZZY ACADEMY.

## Entregas

O M10 mostra apenas status e timestamps.

Ele NÃO retorna:
- keys;
- contas;
- links privados;
- conteúdo de reward delivery;
- checkout proof;
- HMAC;
- cart snapshot.

A revelação/cópia segura entra no M11 CRAZZY LIBRARY.

## Discord sync

O painel mostra:
- conexão;
- username/avatar;
- guild configured;
- guild membership;
- last checked.

Para atualizar:
- conta sem Discord -> linkIdentity;
- conta conectada -> reautenticação Discord.

Provider token continua efêmero e não é salvo.

## Segurança

- `entitlements`: anon sem SELECT;
- `discord_role_grants`: anon sem SELECT;
- authenticated: somente própria linha ou admin;
- API Client Hub usa RLS;
- resposta com Cache-Control private, no-store;
- conteúdo sensível de entrega não sai na API;
- conteúdo protegido de tutorial não sai na API;
- Security Advisor Supabase: 0 lints após a migration.

## Dependências futuras

M10 está pronto para receber dados de:
- M11 Library;
- M22 Academy;
- M43 Fulfillment Engine;
- M44 Discord Bridge.

Esses módulos escrevem/revelam conteúdo; o M10 permanece o painel consolidado de status.
