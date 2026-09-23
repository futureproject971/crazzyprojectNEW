# CRAZZY PROJECT — STATUS CANÔNICO

Atualizado em: 2026-09-23  
Repositório oficial: `futureproject971/crazzyprojectNEW`  
Branch de consolidação atual: `modules-m31-m44-ops`  
PR de consolidação: **#50 — draft**  
Nome oficial obrigatório: **CRAZZY PROJECT**

> Este arquivo é a fonte rápida de verdade para status. CHECKLIST-MASTER, ROADMAP e MODULE_STATUS preservam histórico e requisitos, mas podem conter trechos antigos.

## 1. MAIN JÁ INTEGRADA

A `main` já contém o núcleo M00→M29, incluindo os merges posteriores de:
- CRAZZY CALL;
- Discord Auth obrigatório para CALL;
- Unified Discord Bot Core;
- Campaign Center;
- Server Builder SAFE MODE;
- Product / Category / Stock / Sales / Payments managers.

A PR legada do CALL **#38 foi encerrada sem merge** porque foi substituída pelo CALL/Auth mais novo já presente na base atual.

## 2. PR #50 — CONSOLIDAÇÃO EM QA

A branch `modules-m31-m44-ops` contém, além da main:

- **M30 — CRAZZY Finance**
  - receita, taxas reais/estimadas, líquido, refunds, chargebacks, holds;
  - nenhuma taxa PurinCash inventada;
  - migration real do Supabase versionada.
- **M31 — Customer 360**
  - conta, Discord, roles, pagamentos, entitlements, deliveries, tickets.
- **M32 — Support Desk**
  - fila staff, prioridade, atribuição, conversa e Customer 360.
- **M33 — Community Mod**
  - soft delete, ban/unban, motivo e trilha de moderação.
- **M34 — Resellers**
  - desconto, validade, catálogo permitido, hub reseller e histórico.
- **M35 — Club Manager**
- **M36 — Reward Manager**
- **M37 — Luck Manager**
- **M38 — Coupon Manager**
- **M39 — Appearance**
  - tema padrão global;
  - permitir/bloquear troca manual;
  - accent global;
  - motion/ambient effects;
  - marca/nome/logo oficiais não são editáveis.
- **M40 — Settings & Integrations**
  - status real de Supabase, Discord, OAuth, LiveKit, LZT, Bot Core e pagamentos.
- **M41 — Notify**
  - inbox do cliente;
  - criação admin;
  - fila opcional de DM Discord;
  - worker no mesmo Bot Core.
- **M42 — PWA**
  - manifest;
  - service worker;
  - fallback offline;
  - não cacheia API/auth.
- **M43 — Fulfillment Engine**
  - ledger idempotente do pós-pagamento;
  - entitlement;
  - Library;
  - entrega;
  - solicitação de role Discord;
  - eventos.
- **M44 — Discord Bridge**
  - entitlement continua fonte de direitos;
  - grant/revoke/retry/reconcile;
  - worker no mesmo Bot Core.
- **M45 — Tutorial Studio**
  - editor admin baseado no renderer M22;
  - tutorial público ou por produto;
  - blocks editáveis.
- **M47 — Security Sentinel**
  - eventos estruturados;
  - INFO/WARN/HIGH/CRITICAL;
  - acknowledge/resolution;
  - alerta privado Discord;
  - role configurável pingada apenas em CRITICAL.

Também foi transplantado seletivamente da PR #48:
- Gekko + Raze à esquerda;
- Yoru + Chamber à direita;
- vapor/fumaça animada;
- slogan `QUEM NAO XITA NAO BRILHA`;
- sem trazer alterações antigas de Auth/CALL/Checkout/Support da branch visual.

## 3. SUPABASE — ESTADO REAL

Migrations aplicadas incluem:
- M30 Finance;
- M31–M38 admin operations batch;
- M39 Appearance;
- M41 Notify;
- M43 Fulfillment Engine;
- M44 Discord Bridge;
- M45 Tutorial Studio;
- M47 Security Sentinel.

Configuração conhecida:
- `DISCORD_GUILD_ID`: configurado;
- `LZT_MARKET_TOKEN`: não configurado;
- `DISCORD_SECURITY_CHANNEL_ID`: não configurado;
- `DISCORD_SECURITY_ROLE_ID`: não configurado;
- PIX/Card/Crypto: **desligados** no fail-safe.

Banco operacional ainda vazio:
- auth users: 0;
- products: 0;
- product plans: 0;
- stock items: 0;
- payments: 0;
- entitlements: 0;
- fulfillment runs: 0;
- support tickets: 0;
- community messages: 0;
- Discord role grants: 0;
- Discord notification jobs: 0;
- Security events: 0.

Bot Core:
- nenhum heartbeat registrado ainda em `discord_campaign_worker_status`.

## 4. BLOQUEIOS EXTERNOS ANTES DE CLIENTES REAIS

1. Configurar/testar Discord OAuth no Supabase + Discord Developer Portal.
2. Confirmar callbacks de produção.
3. Configurar/testar LiveKit real para CRAZZY CALL.
4. Subir o Unified Discord Bot Core na Discloud e confirmar heartbeat.
5. Configurar canal privado `#security-logs` e role opcional para CRITICAL.
6. Criar catálogo real de produtos e planos.
7. Alimentar estoque real.
8. Validar PurinCash em ambiente controlado e só depois habilitar métodos.
9. Configurar LZT apenas se Accounts Market for realmente ativado.
10. Rodar compra real controlada ponta a ponta:
    pagamento → entitlement → fulfillment → Library → tutorial → Discord role → notify.
11. Revisar advisors de segurança antes de produção.

## 5. SEGURANÇA

As tabelas privadas `private.library_delivery_secrets` e `private.lzt_rate_limit` continuam sem RLS, porém:
- anon não possui privilégios;
- authenticated não possui privilégios;
- service role possui acesso.

Não habilitar RLS cegamente nessas tabelas sem revisar os writers server-side.

O Security Advisor ainda lista funções `SECURITY DEFINER` expostas a anon/authenticated. Algumas são intencionais e fazem checks internos, mas precisam de revisão individual antes de chamar o projeto de production-ready.

## 6. MÓDULO BLOQUEADO

**M46 — MT Sounds technical migration**
- depende do source/repositório original;
- não deve ser recriado às cegas;
- rota pública/parceiro existente pode permanecer como ponte até a migração técnica.

## 7. PRS LEGADAS

- **#38 CRAZZY CALL**: fechada, superseded.
- **#47 M30 Finance**: conteúdo Finance foi transplantado seletivamente para #50; fechar após QA verde.
- **#48 Hero Valorant**: hero foi transplantado seletivamente para #50; fechar após QA verde.
- **#50**: PR canônica atual de consolidação, mantida em draft até gates verdes.

## 8. PRÓXIMO GATE

Antes de mergear #50:
- TypeScript PASS;
- Next production build PASS;
- smoke M30 PASS;
- Bot Core syntax PASS;
- Vercel preview PASS;
- advisors revisados;
- nenhuma regressão de Auth/CALL/Checkout/Support.

Depois do merge:
- fechar #47/#48;
- deploy/heartbeat Discloud;
- Discord OAuth;
- LiveKit;
- catálogo/estoque;
- PurinCash controlado;
- E2E completo;
- só então abrir o site para clientes reais.
