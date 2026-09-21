# CONTINUE HERE — CRAZZY PROJECT

Última atualização: 2026-09-21

Este arquivo existe para retomar o projeto imediatamente em uma nova conversa/Worker sem perder contexto.

## REPO
- GitHub: futureproject971/crazzyprojectNEW
- Base principal atual: phase-1-home
- M05 branch: m05-product-view
- Architecture update branch: architecture-v2-integrations

## ESTADO EXATO

### Integrado/aprovado
- M00 CRAZZY DESIGN SYSTEM
- M01 CRAZZY APP SHELL
- M02 CRAZZY HOME
- M03 CRAZZY DISCOVERY
- M04 CRAZZY CATALOG

### M05 CRAZZY PRODUCT VIEW
- INTEGRADO
- PR #6 mergeado em 2026-09-21
- QA: typecheck PASS / build PASS / GitHub Actions PASS

### Arquitetura V2
- INTEGRADA
- PR #7 mergeado em 2026-09-21
- inclui atualização completa para:
  - PurinCash
  - Discord Bridge
  - Entitlements
  - Fulfillment
  - Tutorial Studio
  - Pink/Fortune/IFOOD migration matrix
  - MT Sounds parceiro
  - novos módulos M43-M47

### M06
- EM ANDAMENTO na branch `m06-accounts-market`
- PR #8 aberto como draft
- usuário confirmou em 2026-09-21 que esta será a PRIMEIRA configuração LZT
- não existe token/integracao live antiga para recuperar
- adapter oficial multijogo já criado para VALORANT, LoL, Fortnite e Minecraft
- Edge Function `lzt-market` está versionada e com detalhe sanitizado/rate-limit
- CI/typecheck/build PASS
- blocker atual: criar primeiro Access Token LZT com scope `market`

## FONTES ANTIGAS AUDITADAS

### FortuneECrazzy
Referência histórica para UI/regras caso o source seja localizado.
IMPORTANTE: o usuário confirmou que LZT nunca foi configurado antes. Não procurar token antigo nem tratar Fortune como integração live.

### Pink
Fonte preferida para:
- raspadinha UI/admin
- ideias de estoque/cupom/revendedor
- tutorial por produto, upload/mídia e sort_order

Não copiar RNG da raspadinha. Sorteio precisa ser server-side.

### IFOOD 420
Usar como referência de robustez PurinCash:
- preço recalculado no servidor
- secrets server-side
- webhook HMAC
- idempotência
- checagem de valor
- polling/reconciliação
- histórico de cobranças

Não copiar regras de motoboy/delivery.

### MT Sounds
Site atual:
https://mtsounds.vercel.app

Decisão do usuário:
- o site antigo encerra como site separado
- entra para dentro da CRAZZY PROJECT
- parceiro gratuito
- muito usado por usuários de MTA
- deve ser a ÚLTIMA aba pública
- rota planejada: /mtsounds
- preferência técnica: migrar source para dentro do Next.js
- iframe só como fallback temporário
- ainda falta source/repo do MT Sounds

## PURINCASH

Gateway oficial planejado:
- PIX
- cartão
- LTC

Arquitetura:
- CRAZZY PROJECT continua fonte de produtos/pedidos/entitlements
- PurinCash recebe/confirma pagamento
- nunca confiar no preço do frontend
- nunca liberar por successUrl
- validar webhook
- deduplicar
- confirmar valor
- entrega só depois de pagamento confirmado

Modos de entrega previstos:
- internal_stock
- purincash_supplier
- lzt_account
- manual
- service

## ENTREGA / FULFILLMENT

Novo M43 CRAZZY FULFILLMENT ENGINE.

Depois do pagamento:
1. confirmar pagamento
2. confirmar valor/pedido
3. criar entitlement
4. entregar key/conta/link/serviço
5. liberar tutorial
6. solicitar cargo Discord
7. registrar evidência
8. notificar cliente
9. concluir fulfillment

Tudo idempotente para impedir entrega duplicada.

## DISCORD

Novo M44 CRAZZY DISCORD BRIDGE.

Objetivo:
- site e bot sincronizados
- discord user id
- guild member
- mapeamento product -> role
- grant/revoke
- retry/reconcile
- cor/prioridade
- perfil no chat estilo Discord

No chat:
- nick usa cor do cargo visível de maior prioridade
- ao clicar no usuário aparecem avatar/info/cargos/badges
- cargo Discord manual NÃO concede automaticamente produto pago
- entitlement do site é a fonte de verdade

Recomendação atual:
- UMA role por produto/benefício
- NÃO uma role nova por cliente

## TUTORIAIS

M22 CRAZZY ACADEMY = viewer.

Novo M45 CRAZZY TUTORIAL STUDIO = editor admin.

Tutorial pode ser:
- público/global
- protegido por produto/entitlement

Editor em blocos:
- título
- subtítulo
- texto
- imagem
- vídeo
- galeria
- checklist
- teclas/keybinds
- código
- arquivo
- botão/link
- caixa azul INFO
- caixa vermelha ATENÇÃO
- caixa amarela IMPORTANTE
- caixa verde SUCESSO
- separador
- passo numerado

Blocos devem permitir:
- drag and drop
- reordenação
- seções
- preview
- draft/publicado
- associação a produto/plano
- controle de acesso

Pink pode fornecer partes úteis de upload/mídia/sort_order, mas o editor de blocos será evolução CRAZZY.

## RASPADINHA

M18/M37.

Pink tem UI/admin completos, porém:
- RNG atual não deve ser copiado
- sorteio precisa ir para backend/server
- chances auditáveis
- pagamento confirmado antes de jogada paga
- idempotência/logs
- prêmio pode ser produto/conta/cupom/reward

## MT SOUNDS

Adicionado ao roadmap como:
- M23.1 experiência pública
- M46 módulo técnico

Regra:
- última aba pública
- parceiro
- free
- dentro do mesmo App Shell
- preservar experiência conhecida da ferramenta

## DOCUMENTOS IMPORTANTES

Na branch architecture-v2-integrations:
- docs/ROADMAP.md
- docs/ARCHITECTURE-INTEGRATIONS.md
- docs/SOURCE-MIGRATION-MATRIX.md
- docs/M06-PREFLIGHT.md
- docs/DECISIONS-BEFORE-M06.md
- docs/CHECKLIST-MASTER.md

## DECISÕES D01-D10 APROVADAS

- D01: keys híbridas; internal_stock padrão.
- D02: roles Discord no formato `emoji | PRODUTO`.
- D03: cargo expira; histórico/key entregue permanece; tutorial permanece após expiração normal.
- D04: reaproveitar bot CRAZZY se saudável, com sync isolado.
- D05: PurinCash é gateway; CRAZZY é fonte de verdade.
- D06: tutorial por produto/plano; vídeo por upload + link/embed; mantém acesso após expiração normal.
- D07: MT Sounds será portado para Next.js; source/repo continua dependência futura do M46.
- D08: refund/dispute revoga entitlement/cargo/novos acessos e mantém logs/evidências.
- D09: cor do nick = maior role visível.
- D10: canal padrão `#security-logs`; CRITICAL pode pingar somente role admin/security configurada.

## REGRA DO USUÁRIO SOBRE MIGRAÇÃO

Sempre que houver dúvida entre criar do zero ou migrar:
- procurar primeiro no Fortune, Pink, IFOOD 420 e MT Sounds
- dizer o que já existe
- recomendar migrar ou recriar
- perguntar ao usuário quando isso mudar comportamento/negócio

Pensar assim:
"os sites antigos vendiam a mesma coisa; se o recurso era útil antes, auditar antes de descartar."

## PRs MERGEADOS

- PR #6 — M05 CRAZZY PRODUCT VIEW — MERGEADO
- PR #7 — Architecture V2 — MERGEADO

## PRÓXIMO PASSO CORRETO

M06 está LIBERADO.

1. branch `m06-accounts-market` já criada
2. adapter oficial LZT multijogo já criado
3. criar primeiro API Client/Access Token LZT com scope `market`
4. salvar como Edge Function Secret `LZT_MARKET_TOKEN`
5. rodar smoke real Riot/LoL + Fortnite + Minecraft
6. confirmar fórmula final de markup
7. não misturar M06 com checkout/PurinCash
8. manter MT Sounds separado no M46

## PROMPT CURTO PARA NOVA CONVERSA

"Abra o repo futureproject971/crazzyprojectNEW. Leia PRIMEIRO docs/00_CONTINUE_NEXT_CHAT.md na branch architecture-v2-integrations. Depois leia SEM PULAR: docs/ROADMAP.md, docs/CHECKLIST-MASTER.md, docs/ARCHITECTURE-INTEGRATIONS.md, docs/SOURCE-MIGRATION-MATRIX.md, docs/M06-PREFLIGHT.md e docs/DECISIONS-BEFORE-M06.md. Verifique os PRs #6 e #7 e o estado das branches. Preserve M00-M05. Considere M43 Fulfillment, M44 Discord Bridge, M45 Tutorial Studio, M46 MT Sounds e M47 Security Sentinel como parte obrigatória da arquitetura. NÃO recrie funções que já existam no FortuneECrazzy, Pink, IFOOD 420 ou MT Sounds sem antes comparar, recomendar migrar/recriar e perguntar quando a decisão mudar regra de negócio. M06 deve vir do Fortune/LZT, não do zero. PurinCash será estudado para PIX/cartão/LTC; entrega usa Entitlements/Fulfillment; tutoriais são liberados por direito; Discord sincroniza cargos; M47 registra bugs e tentativas suspeitas e envia alertas seguros pelo bot. Antes de iniciar M06, feche comigo todas as decisões pendentes D01-D10. Continue exatamente de onde paramos."


## SECURITY SENTINEL

Novo M47 — CRAZZY SECURITY SENTINEL.

Objetivo:
- registrar bugs críticos;
- registrar tentativas suspeitas;
- detectar tentativa de admin sem permissão;
- detectar tentativa de acessar estoque/keys sem autorização;
- registrar price/payload tamper;
- webhook inválido/replay;
- brute/repeated login attempts;
- privilege escalation;
- erros LZT/PurinCash/Fulfillment/Discord;
- alertar pelo bot Discord.

Regras:
- severidade INFO/WARN/HIGH/CRITICAL;
- canal de segurança configurável;
- CRITICAL pode mencionar cargo configurável;
- cooldown/agregação para não spammar;
- deduplicação;
- sem secrets/tokens/keys/licenças nos logs;
- mascarar dados sensíveis;
- Discord offline não bloqueia o sistema;
- painel de auditoria admin.

D10 aprovado:
- canal padrão privado: #security-logs;
- INFO/WARN sem ping;
- HIGH normalmente sem ping;
- CRITICAL pode mencionar somente role admin/security configurada;
- cooldown/agregação/deduplicação obrigatórios.


---

## M07 — CRAZZY CART

### M07 CRAZZY CART
- branch: `m07-cart`
- status: CONCLUÍDO tecnicamente
- rotas:
  - `/carrinho`
  - `/combo`
- carrinho global persistente em localStorage
- quick cart via Drawer
- badge real no App Shell
- produto + plano + quantidade
- conta LZT pode ser preservada no carrinho sem inventar preço
- alteração de plano dentro do carrinho
- cupom salvo para validação server-side no M08
- checkout bloqueado se preço autoritativo não existir
- planos padrão CRAZZY:
  - 1 dia
  - 3 dias
  - 7 dias
  - 15 dias
  - 30 dias / Mensal
  - 90 dias
  - Lifetime
- produto é cadastrado uma vez; variações usam códigos fixos do sistema
- stock 0: oculto por padrão
- override futuro: mostrar como esgotado
- Combo Mensal e Combo Lifetime:
  - 2 produtos diferentes = 10%
  - 3 = 15%
  - 4 = 20%
  - 5 = 25%
  - 6 = 30%
  - 7+ = 35% teto
- quantidade repetida não sobe faixa
- Mensal/Lifetime são calculados separadamente
- cupom + combo não acumulam; M08 deve usar o benefício válido mais vantajoso
- política central: `src/core/commerce/policy.ts`
- regras documentadas: `docs/M07-CART-COMBO-RULES.md`
- QA: typecheck PASS / build PASS / GitHub Actions PASS

### Próximo módulo
M08 — CRAZZY CHECKOUT.


---

## M08 — CRAZZY CHECKOUT

### M08 CRAZZY CHECKOUT
- branch: `m08-checkout`
- frontend: `/checkout`
- API proxy:
  - /api/checkout/config
  - /api/checkout/quote
  - /api/checkout/create
  - /api/checkout/status
- PurinCash Edge Function atual: v5
- PIX/cartão/LTC estruturados
- métodos continuam disabled até secrets/configuração operacional
- checkout exige autenticação; M09 fornece a sessão
- combo e cupom recalculados server-side
- aplica somente o maior benefício válido
- criação protegida por idempotency_key
- webhook HMAC + reconciliação + value check
- entrega protegida por claim idempotente
- LZT não usa mais RUB_TO_BRL fixo
- payments RLS: cliente lê apenas os próprios e não pode alterar dados comerciais
- migration: `m08_checkout_policy_and_idempotency`
- regras: `docs/M08-CHECKOUT-RULES.md`

### Ativação adiada
Na etapa de integrações/SQL:
- PURINCASH_API_KEY
- PURINCASH_WEBHOOK_SECRET
- CHECKOUT_SIGNING_SECRET
- PUBLIC_SITE_URL
- ENABLE_CARD_CHECKOUT
- payment_settings pix/card/crypto

### Próximo módulo
M09 — CRAZZY AUTH.


---

## M09 — CRAZZY AUTH

### M09 CRAZZY AUTH
- branch: `m09-auth`
- Supabase SSR Auth integrado
- dependências pinadas:
  - @supabase/supabase-js 2.109.0
  - @supabase/ssr 0.12.0
- package-lock.json versionado
- site permanece público
- middleware protege apenas áreas privadas
- rotas privadas preparadas:
  - /checkout
  - /painel
  - /cliente
  - /perfil
  - /tickets
  - /chat
- Discord OAuth usa identify/email/guilds
- Edge Function: `auth-discord-sync` v1
- token Discord não é salvo
- tabela `discord_identities`
- guild status persistido como dado verificado
- membership não é barreira global do site
- Google é opcional e desligado por padrão
- novos usuários recebem role `user`
- roles: user / moderator / admin
- header muda automaticamente visitor -> client/admin
- checkout M08 agora usa sessão Supabase real
- RLS e trigger auditados
- Security Advisor: 0 lints
- regras: `docs/M09-AUTH-RULES.md`

### Ativação OAuth pendente
Na etapa de integrações:
- Discord Client ID
- Discord Client Secret
- Site URL
- redirect allowlist /auth/callback
- DISCORD_GUILD_ID
- habilitar novos cadastros
- Google provider somente se desejado

### Próximo módulo
M10 — CRAZZY CLIENT HUB.


---

## M10 — CRAZZY CLIENT HUB

### M10 CRAZZY CLIENT HUB
- branch: `m10-client-hub`
- painel privado consolidado:
  - /painel
  - /painel/pedidos
  - /painel/produtos
  - /painel/tutoriais
  - /painel/entregas
  - /painel/discord
- API: `/api/client-hub`
- usa sessão Supabase/RLS do próprio usuário
- NÃO usa service role para ler o painel
- payments/order_tickets alimentam histórico
- tabela `entitlements` criada e protegida
- tabela `discord_role_grants` criada e protegida
- M43 será escritor autoritativo de entitlements
- M44 será escritor autoritativo de Discord role grants
- tutorial aparece como direito liberado, mas conteúdo protegido não sai no M10
- M22 será viewer protegido de tutorial
- entrega aparece somente como status; key/conta/link não sai no M10
- M11 será responsável por revelar/copiar conteúdo sensível
- Discord mostra conexão/guild/last sync e permite reconnect
- anon não pode SELECT em entitlements/discord_role_grants
- Security Advisor: 0 lints
- regras: `docs/M10-CLIENT-HUB-RULES.md`

### Próximo módulo
M11 — CRAZZY LIBRARY.


---

## M11 — CRAZZY LIBRARY — EM ANDAMENTO

### ORDEM OBRIGATÓRIA PARA O PRÓXIMO WORKER
1. `docs/CHECKLIST-MASTER.md`
2. `docs/M11-WORKER-HANDOFF.md`
3. este arquivo `docs/00_CONTINUE_NEXT_CHAT.md`

Branch:
- `m11-library`

Estado exato:
- M11 iniciado;
- frontend/backend final AINDA não implementados;
- auditoria inicial do banco concluída parcialmente;
- problema crítico identificado em `stock_items.content` e `reward_deliveries.content`;
- cliente pode acabar lendo conteúdo sensível diretamente pelas policies atuais;
- prioridade nº 1 é corrigir arquitetura de secrets/reveal;
- NÃO criar UI de reveal antes da migration/segurança;
- NÃO mergear M11 antes de smoke + Security Advisor + typecheck + production build.

Fonte de verdade detalhada:
- `docs/M11-WORKER-HANDOFF.md`

Checklist granular:
- `docs/CHECKLIST-MASTER.md`

Próximo módulo APENAS depois do merge do M11:
- M12 — CRAZZY PROFILE.
