# CRAZZY PROJECT — MASTER CHECKLIST

## 🔒 PEDIDOS FIXADOS PELO DONO — NÃO ESQUECER

- [x] **Cards do site com fundo premium**: navy/dark glass, degradê, brilho azul suave e profundidade. **Não aplicar sobre wallpaper, fotos, capas, banners, thumbnails, galerias, vídeos, roleta/raspadinha ou outras artes.**
- [x] **CRAZZY CALL**: voz, vídeo, compartilhamento de tela, múltiplas transmissões, fullscreen e Picture-in-Picture nativo do navegador.
- [x] **CRAZZY Community integrada ao CALL**: chat estilo Discord + acesso a salas de voz/vídeo/tela dentro da própria experiência da Comunidade. `/call` continua existindo como acesso direto.
- [x] **Campaign Center no site**: sistema de divulgação Discord deve ser controlado pelo admin do CRAZZY PROJECT.
- [x] **Preview da embed em tempo real** dentro do site antes do disparo.
- [x] **Templates centralizados** no Supabase, sem depender de `templates.json` local como fonte principal.
- [x] **Públicos de campanha**: todos, somente online, cargo específico e teste individual.
- [x] **Agendamento, fila, progresso, cancelamento e histórico** dos disparos.
- [x] **Teste para a própria DM** do administrador antes de disparar em massa.
- [x] **Worker continua na Discloud**, pois o bot precisa permanecer conectado ao Discord Gateway 24/7.
- [x] **UM ÚNICO BOT DISCORD CRAZZY PROJECT**: um token, um processo/worker na Discloud e módulos internos. Não hospedar vários bots separados.
- [ ] Migrar para esse bot único todos os sistemas Discord existentes e futuros:
  - [x] Campanhas/DM
  - [x] Server Builder SAFE MODE
  - [ ] Discord Bridge de cargos/entitlements
  - [ ] Notificações do site
  - [ ] Tickets/suporte
  - [ ] Alertas do Security Sentinel
  - [ ] Slash commands administrativos
  - [ ] Outras automações Discord futuras
- [x] Os comandos antigos de divulgação devem continuar disponíveis, mas usando a mesma base/fila do site.
- [x] **Server Builder unificado no mesmo bot/token**: /preview-tema + /montar-servidor, editor no site, fila, diff, histórico e SAFE MODE append-only.
- [x] **SAFE MODE reforçado**: não apagar, renomear, mover, reposicionar ou alterar permissões de recursos existentes; criar somente o que estiver faltando.
- [x] **Painel Bot Core** em /admin/discord: saúde do worker, módulos, estrutura do servidor e execução do builder.
- [x] Mesmo bot, mesma guild, mesmo Supabase e **mesmo token Discord** para todos os módulos.
- [x] Token Discord e Supabase service-role **somente na Discloud/server**, nunca no navegador.


Última atualização: 2026-09-22

## ✅ INTEGRADO

- [x] M00 — CRAZZY DESIGN SYSTEM
- [x] M01 — CRAZZY APP SHELL
- [x] M02 — CRAZZY HOME
- [x] M03 — CRAZZY DISCOVERY
- [x] M04 — CRAZZY CATALOG

## ✅ M05 INTEGRADO

### M05 — CRAZZY PRODUCT VIEW
- [x] /produto/[slug]
- [x] galeria
- [x] thumbnails
- [x] zoom
- [x] badges
- [x] status/estoque
- [x] planos
- [x] seleção de plano
- [x] CTA visual
- [x] descrição
- [x] compatibilidade
- [x] requisitos
- [x] benefícios
- [x] FAQ
- [x] avaliações
- [x] relacionados
- [x] metadata
- [x] 404
- [x] loading/error
- [x] desktop/tablet/mobile
- [x] typecheck
- [x] build
- [x] CI
- [x] merge PR #6

## 🟦 ARQUITETURA V2 DOCUMENTADA / PR #7

- [x] PurinCash definido como gateway
- [x] PIX planejado
- [x] cartão planejado
- [x] LTC planejado
- [x] webhook HMAC
- [x] idempotência
- [x] polling/reconcile
- [x] preço server-side
- [x] Entitlements
- [x] Fulfillment Engine
- [x] Discord Bridge
- [x] Tutorial Studio
- [x] MT Sounds Partner
- [x] Security Sentinel
- [x] matriz migrar vs recriar
- [x] handoff próxima conversa
- [x] merge PR #7

---

## ✅ M06 — CRAZZY ACCOUNTS MARKET — ESTRUTURA INTEGRADA
Fonte: API oficial LZT Market. Primeira configuração LZT do usuário; FortuneECrazzy fica como referência histórica quando disponível.

- [x] migrar listagem (VALORANT/LZT)
- [x] migrar detalhes (provider read-only)
- [x] Valorant
- [x] LoL (adapter pronto; provider aguarda credencial)
- [x] Fortnite (adapter pronto; provider aguarda credencial)
- [x] Minecraft (adapter pronto; provider aguarda credencial)
- [x] rank
- [x] level
- [x] região
- [x] skins
- [ ] inventário
- [x] filtros (VALORANT)
- [ ] markup
- [ ] compra/entrega LZT
- [x] adaptar para CRAZZY UI (primeiro corte)
- [x] loading/error/empty
- [x] desktop/tablet/mobile

### BLOQUEIO EXTERNO M06
- [ ] LZT credential configurada no backend (Edge Secret ou system_credentials admin-only)
- [x] placeholder seguro criado sem valor
- [x] adapter multijogo Riot/LoL + Fortnite + Minecraft criado
- [x] action de detalhe sanitizado criada
- [x] fallback de credencial server-side preparado
- [ ] smoke test real contra provider (desbloqueia automaticamente quando a credencial existir)
- [x] BRL direto no provider confirmado\n- [ ] fórmula de markup comercial validada

### QA M06 — corte VALORANT
- [x] API pública somente leitura via Next
- [x] token LZT não exposto
- [x] fast-buy não exposto
- [x] TypeScript PASS
- [x] Next production build PASS
- [x] GitHub Actions PASS
- [x] LoL via adapter multijogo
- [x] Fortnite via adapter multijogo
- [x] Minecraft via adapter multijogo
- [ ] preço comercial/markup validado
- [ ] compra/entrega LZT integrada ao M43

## ✅ M07 — CRAZZY CART — CONCLUÍDO
- [x] carrinho global persistente
- [x] produto
- [x] conta LZT
- [x] plano
- [x] planos padrão 1d/3d/7d/15d/30d/90d/lifetime
- [x] quantidade
- [x] alterar plano no carrinho
- [x] remover item / limpar carrinho
- [x] cupom preservado para validação server-side
- [x] subtotal
- [x] desconto
- [x] total
- [x] carrinho rápido / drawer
- [x] página completa /carrinho
- [x] /combo
- [x] Combo Mensal
- [x] Combo Lifetime
- [x] 2 produtos = 10%
- [x] 3 produtos = 15%
- [x] 4 produtos = 20%
- [x] 5 produtos = 25%
- [x] 6 produtos = 30%
- [x] 7+ produtos = 35% teto
- [x] produto repetido não sobe faixa
- [x] Mensal/Lifetime calculados separados
- [x] cupom + combo não acumulam
- [x] preço ausente bloqueia checkout
- [x] desktop/tablet/mobile
- [x] loading/error/empty
- [x] typecheck
- [x] production build
- [x] GitHub Actions
- [x] stock 0 oculto por padrão
- [x] admin poderá exibir stock 0 como esgotado

## ✅ M08 — CRAZZY CHECKOUT — ESTRUTURA CONCLUÍDA
- [x] /checkout
- [x] PIX PurinCash
- [x] cartão PurinCash
- [x] LTC PurinCash
- [x] QR/copia e cola
- [x] checkout hospedado
- [x] endereço LTC sem arredondamento
- [x] expiração/status
- [x] webhook
- [x] HMAC SHA-256 sobre corpo cru
- [x] idempotência de criação por user + attempt key
- [x] polling/reconcile
- [x] value check
- [x] checkout proof assinado
- [x] anti-entrega-duplicada
- [x] combo recalculado server-side
- [x] cupom recalculado server-side
- [x] combo/cupom usa melhor benefício sem acumular
- [x] RLS de payments auditado
- [x] LZT sem câmbio RUB fixo
- [x] métodos ficam fail-closed quando desabilitados
- [x] gate de autenticação preparado para M09
- [ ] ativar secrets PurinCash na etapa de integrações/SQL
- [ ] habilitar payment_settings após testes
- [x] sessão real fornecida pelo M09

## ✅ M09 — CRAZZY AUTH — ESTRUTURA CONCLUÍDA
- [x] /login
- [x] /cadastro compatível com login social
- [x] /reset-password adaptado para recuperação social
- [x] Discord OAuth
- [x] Discord identity linking
- [x] Discord user id persistido server-side
- [x] guild status verificado via scope guilds
- [x] guild membership não bloqueia navegação pública
- [x] Google opcional por feature flag
- [x] sessão SSR com cookies
- [x] refresh de sessão via middleware
- [x] getClaims para proteção de rotas
- [x] getUser para identidade atual
- [x] roles user/moderator/admin
- [x] novos usuários recebem role user
- [x] header reage à sessão/role
- [x] logout real
- [x] checkout M08 conectado ao access token real
- [x] Discord provider token não é persistido
- [x] RLS discord_identities
- [x] profiles restrito ao dono/admin
- [x] trigger SECURITY DEFINER endurecido
- [x] package versions pinadas
- [x] package-lock commitado
- [x] auth-discord-sync versionada
- [x] migration M09 aplicada/versionada
- [x] Security Advisor Supabase sem lints
- [ ] configurar Discord Client ID/Secret no Supabase Auth
- [ ] configurar Site URL + redirect allowlist
- [ ] preencher DISCORD_GUILD_ID
- [ ] habilitar Google somente se desejado

## ✅ M10 — CRAZZY CLIENT HUB — CONCLUÍDO
- [x] overview
- [x] /painel
- [x] /painel/pedidos
- [x] /painel/produtos
- [x] /painel/tutoriais
- [x] /painel/entregas
- [x] /painel/discord
- [x] snapshot API privado
- [x] pedidos
- [x] pagamentos
- [x] produtos ativos
- [x] entitlements
- [x] tabela entitlements com RLS
- [x] cargos/app roles
- [x] tabela discord_role_grants com RLS
- [x] tutoriais liberados sem expor conteúdo protegido
- [x] entregas sem expor keys/links/conteúdo sensível
- [x] sync/reconnect Discord
- [x] guild status
- [x] loading/error/empty
- [x] desktop/tablet/mobile
- [x] Security Advisor sem lints
- [x] smoke anon bloqueado de entitlements/grants
- [x] catálogo público continua público
- [x] boundaries M11/M22/M43/M44 preservadas

## ✅ M11 — CRAZZY LIBRARY — CONCLUÍDO

### Segurança / arquitetura
- [x] branch `m11-library`
- [x] auditoria integral de `claim_paid_delivery`
- [x] `FOR UPDATE SKIP LOCKED` e idempotência preservados
- [x] GRANTs/RLS de stock/reward/order/trial auditados
- [x] migration `m11_library_secure_reveal`
- [x] migration `m11_library_account_payload_format`
- [x] `public.library_deliveries`
- [x] `private.library_delivery_secrets`
- [x] `public.library_reveal_events`
- [x] stock plaintext removido do acesso do cliente
- [x] reward plaintext removido do acesso do cliente
- [x] secrets server-only
- [x] authenticated sem SELECT em secret table
- [x] reveal/copy RPCs service-role only
- [x] snapshot sem key/login/senha/token/link privado
- [x] reveal valida sessão + ownership + status + expiração + entitlement
- [x] reveal registra auditoria
- [x] copy registra evento sem reenviar o segredo
- [x] nenhum secret em localStorage/sessionStorage/cookie/URL
- [x] plaintext existe apenas temporariamente em React state
- [x] rate limit de reveal
- [x] usuário banido bloqueado no backend

### Writers legados alinhados
- [x] `rewards` v5 não retorna mais `content` no status
- [x] `purincash-payment` v6 não envia credenciais LZT em ticket
- [x] tutorial sensível não é mais publicado em ticket
- [x] ticket de produto entregue aponta para CRAZZY LIBRARY
- [x] Client Hub lê metadata segura da Library

### Library UI
- [x] `/biblioteca`
- [x] alias `/painel/biblioteca`
- [x] Minhas Keys
- [x] Minhas Contas
- [x] Links / Downloads
- [x] Trials / Recompensas
- [x] revelar
- [x] copiar
- [x] ocultar / mascarar novamente
- [x] histórico de revelações e cópias
- [x] produto/plano/status
- [x] entitlement/status
- [x] expiração
- [x] tutorial associado sem expor conteúdo M22
- [x] status cargo Discord sem invadir M44
- [x] loading/error/empty
- [x] desktop/tablet/mobile
- [x] link no menu da conta
- [x] Client Hub → Library

### QA M11
- [x] anon bloqueado de stock/reward/library/events
- [x] private secret schema não exposto
- [x] Library snapshot exige autenticação
- [x] Library reveal exige autenticação
- [x] catálogo público continua público
- [x] authenticated sem EXECUTE direto de reveal/copy RPC
- [x] Security Advisor Supabase: 0 lints
- [x] npm ci PASS
- [x] TypeScript PASS
- [x] production build PASS
- [x] smoke M11 PASS
- [x] validação isolada GitHub Actions PASS
- [x] CI oficial pós-merge na phase-1-home PASS
- [x] PR #13 M11
- [x] merge M11 — d833cbef71175487bbf0c150217a8b32b2953ce1

## ✅ M12 — CRAZZY PROFILE — IMPLEMENTADO / QA FINAL
- [x] branch `m12-profile`
- [x] /perfil
- [x] snapshot privado do perfil
- [x] username protegido
- [x] display name personalizável
- [x] avatar CRAZZY
- [x] fallback/avatar Discord
- [x] avatar source auto/crazzy/discord
- [x] Discord conectado
- [x] guild membership/status
- [x] app roles
- [x] cargos Discord
- [x] badges derivados de fatos reais
- [x] cor principal
- [x] bio curta
- [x] perfil estilo Discord
- [x] editar personalização própria
- [x] validação server-side de nome/bio/cor/avatar source
- [x] RLS owner/admin em profile_preferences
- [x] profiles sensível sem UPDATE direto do cliente
- [x] sem alterar app role pelo cliente
- [x] sem criar Discord role manual pelo cliente
- [x] Auth header usa display name/avatar source
- [x] loading/error
- [x] desktop/tablet/mobile
- [x] Security Advisor: 0 lints
- [x] TypeScript PASS
- [x] production build PASS
- [x] smoke M12 PASS
- [x] GitHub Actions PASS
- [x] PR #14 M12
- [x] merge M12 — 339fb34d4c466a34a23d5a78e23fc5bcaf62072d

## ✅ M13 — CRAZZY SUPPORT — IMPLEMENTADO / QA FINAL
- [x] branch `m13-support`
- [x] M12 confirmado mergeado
- [x] auditoria inicial de `order_tickets` e `ticket_messages`
- [x] suporte genérico separado do fulfillment
- [x] Storage auditado
- [x] bucket público `game-images` rejeitado para Support
- [x] docs Supabase de private bucket/signed URL verificadas
- [x] migration Support versionada/aplicada
- [x] `support_tickets`
- [x] `support_messages`
- [x] `support_attachments`
- [x] `support_ticket_events`
- [x] contexto opcional pedido/produto/entitlement/Library
- [x] categorias de ticket
- [x] prioridade/status
- [x] criação de ticket autenticado
- [x] mensagens cliente/staff
- [x] bucket privado `support-attachments`
- [x] signed upload URL
- [x] signed download URL curta
- [x] imagem
- [x] vídeo
- [x] áudio
- [x] PDF/TXT
- [x] contexto produto/pedido/key sem expor segredo
- [x] entitlement
- [x] tutorial relacionado sem expor conteúdo
- [x] histórico de status/eventos
- [x] fechar/reabrir
- [x] polling seguro com aba visível
- [x] fila preparada para M32 Support Desk
- [x] /tickets
- [x] /tickets/novo
- [x] /tickets/[id]
- [x] App Shell aponta para /tickets
- [x] loading/error/empty
- [x] desktop/tablet/mobile
- [x] Security Advisor: 0 lints
- [x] authenticated sem escrita direta nas tabelas Support
- [x] bucket public=false
- [x] índices de contexto/attachments/eventos
- [x] smoke M13 PASS
- [x] TypeScript PASS
- [x] production build PASS
- [x] GitHub Actions PASS
- [x] PR #15 M13
- [x] merge M13 — da7d4ac9b052493e7b9537ca15afe616db441157

## 🟡 M14 — CRAZZY COMMUNITY — EM ANDAMENTO
- [x] branch `m14-community` criada
- [x] M13 mergeado e CI pós-merge verde
- [x] schema Community
- [x] chat real
- [x] canais/sala principal
- [x] mensagens
- [x] respostas/thread reply
- [x] reações emoji
- [x] perfil clicável
- [x] avatar
- [x] cargos CRAZZY
- [x] cargos Discord
- [x] cor do cargo principal
- [x] badges
- [x] leitura do estado Discord já sincronizado; M44 fará sync autoritativo
- [x] mídia imagem
- [x] mídia vídeo
- [x] mídia áudio
- [x] bucket privado Community
- [x] upload assinado
- [x] polling seguro com aba visível; Realtime adiado sem perda de arquitetura
- [x] rate limit
- [x] moderação básica de própria mensagem
- [x] sem secrets/keys no chat automático
- [x] desktop/tablet/mobile
- [x] loading/error/empty
- [x] Security Advisor: 0 lints
- [x] smoke M14 PASS
- [x] TypeScript PASS
- [x] production build PASS
- [x] GitHub Actions PASS
- [ ] PR M14
- [ ] merge M14

## ❌ M15 — CRAZZY REVIEWS
- [ ] feedback real
- [ ] verificação por compra

## ❌ M16 — CRAZZY CLUB HUB
- [ ] hub

## ❌ M17 — CRAZZY REWARDS
- [ ] missões
- [ ] rewards
- [ ] histórico
- [ ] claim

## ❌ M18 — CRAZZY LUCK
Fonte visual: Pink.
- [ ] roleta
- [ ] raspadinha
- [ ] drops
- [ ] prêmios
- [ ] RNG server-side
- [ ] chances auditáveis
- [ ] pagamento confirmado antes da jogada
- [ ] logs
- [ ] idempotência
- [ ] produto/conta/cupom/reward

## ❌ M19 — CRAZZY COUPONS
- [ ] cupom %
- [ ] cupom fixo
- [ ] por produto
- [ ] limites
- [ ] pedido mínimo
- [ ] expiração

## ❌ M20 — CRAZZY RANK
- [ ] ranking
- [ ] badges
- [ ] integração perfil/chat

## ❌ M21 — CRAZZY STATUS
- [ ] online
- [ ] updating
- [ ] offline
- [ ] status por produto

## ❌ M22 — CRAZZY ACADEMY
- [ ] viewer
- [ ] tutorial público
- [ ] tutorial protegido
- [ ] entitlement check server-side
- [ ] texto
- [ ] imagem
- [ ] vídeo
- [ ] galeria
- [ ] checklist
- [ ] keybind
- [ ] código
- [ ] arquivo
- [ ] caixas coloridas
- [ ] passos

## ❌ M23 — CRAZZY HELP
- [ ] FAQ
- [ ] busca
- [ ] tutoriais públicos

## ❌ M23.1 — MT SOUNDS PARTNER
- [x] definido como free
- [x] última aba pública
- [x] rota planejada /mtsounds
- [x] dentro do App Shell
- [ ] obter source/repo
- [ ] portar para Next.js
- [ ] preservar experiência
- [ ] desativar site separado após migração

---

# ADMIN

## ❌ M24 — CRAZZY CONTROL CENTER
- [ ] dashboard
- [ ] estoque baixo
- [ ] divergência pagamento
- [ ] erro fulfillment
- [ ] erro Discord
- [ ] tutorial faltando
- [ ] resumo Security Sentinel

## ❌ M25 — CRAZZY PRODUCT MANAGER
- [ ] criar/editar produto
- [ ] planos
- [ ] auto-criar variantes 1d/3d/7d/15d/30d/90d/lifetime ao criar produto
- [ ] configurar preço por variante
- [ ] showWhenOutOfStock por variante
- [ ] emoji
- [ ] cargo Discord
- [ ] cor
- [ ] prioridade
- [ ] tutorial
- [ ] delivery mode
- [ ] supplier PurinCash
- [ ] duração/expiração

## ❌ M26 — CRAZZY CATEGORY MANAGER
- [ ] categorias
- [ ] ordenação
- [ ] ícones
- [ ] status

## ❌ M27 — CRAZZY STOCK
- [ ] keys
- [ ] abastecer estoque por variante padrão
- [ ] ocultar plano sem estoque por padrão
- [ ] override para mostrar plano esgotado
- [ ] reserva atômica
- [ ] consumo idempotente
- [ ] lote
- [ ] não reutilizar
- [ ] auditoria
- [ ] supplier externo opcional

## ❌ M28 — CRAZZY SALES
- [ ] vendas
- [ ] pagamento
- [ ] fulfillment
- [ ] entitlement
- [ ] cargo
- [ ] tutorial
- [ ] delivery log

## 🟡 M29 — CRAZZY PAYMENTS — IMPLEMENTADO / QA FINAL
- [x] /admin/pagamentos
- [x] PIX
- [x] cartão
- [x] LTC
- [x] liga/desliga por método
- [x] transações
- [x] filtros por status/método/cliente/payment/charge/idempotency
- [x] webhooks/eventos operacionais
- [x] payment events
- [x] idempotência visível sem expor segredo
- [x] divergências
- [x] reconciliação manual contra PurinCash
- [x] value check antes de fulfillment
- [x] fulfillment idempotente reaproveitado
- [x] status inseguro exige revisão manual
- [x] casos de reembolso
- [x] refund case NÃO movimenta dinheiro automaticamente
- [x] disputes
- [x] evidências
- [x] checkout proof/QR/API key/webhook secret ocultos
- [x] Edge Function purincash-payment v7
- [x] RPCs admin-only / anon bloqueado
- [x] smoke M29 PASS
- [x] TypeScript PASS
- [x] production build PASS
- [x] GitHub Actions PASS
- [x] PR #46 M29
- [x] merge M29 — bf5fab5

## 🟡 M30 — CRAZZY FINANCE — IMPLEMENTADO / QA FINAL
- [x] /admin/finance
- [x] receita por período
- [x] receita por método
- [x] taxas reais por pagamento
- [x] regra estimada de taxa por método
- [x] histórico de vigência das regras
- [x] taxa fixa + percentual
- [x] não precificado quando taxa desconhecida
- [x] líquido parcial quando faltam custos
- [x] líquido estimado somente quando custos estão cobertos
- [x] reembolso concluído
- [x] reembolso pendente
- [x] chargeback perdido
- [x] disputa aberta / exposição
- [x] retenções / holds
- [x] gráfico diário
- [x] custos por transação
- [x] sem taxa PurinCash inventada
- [x] RLS admin-only
- [x] RPCs SECURITY INVOKER
- [ ] smoke M30 PASS
- [ ] TypeScript PASS
- [ ] production build PASS
- [ ] GitHub Actions PASS
- [ ] PR M30
- [ ] merge M30

## ❌ M31 — CRAZZY CUSTOMER 360
- [ ] Discord ID
- [ ] cargos
- [ ] entitlement
- [ ] deliveries
- [ ] tutoriais
- [ ] sync
- [ ] eventos de segurança quando apropriado

## ❌ M32 — CRAZZY SUPPORT DESK
- [ ] fila
- [ ] contexto entitlement/delivery

## ❌ M33 — CRAZZY COMMUNITY MOD
- [ ] moderação
- [ ] cargos
- [ ] cor
- [ ] sync manual
- [ ] auditoria role display

## ❌ M34 — CRAZZY RESELLERS
- [ ] comissão
- [ ] produtos permitidos
- [ ] expiração
- [ ] split opcional
- [ ] auditoria

## ❌ M35 — CRAZZY CLUB MANAGER
- [ ] gestão club

## ❌ M36 — CRAZZY REWARD MANAGER
- [ ] gestão rewards
- [ ] entrega via M43

## ❌ M37 — CRAZZY LUCK MANAGER
- [ ] admin raspadinha
- [ ] admin roleta
- [ ] chances
- [ ] pesos
- [ ] prêmios
- [ ] logs
- [ ] receita

## ❌ M38 — CRAZZY COUPON MANAGER
- [ ] CRUD cupom
- [ ] regras

## ❌ M39 — CRAZZY APPEARANCE
- [ ] tema
- [ ] banners
- [ ] identidade configurável

## ❌ M40 — CRAZZY SETTINGS & INTEGRATIONS
- [ ] Loja
- [ ] PurinCash
- [ ] Discord Bot
- [ ] LZT
- [ ] MT Sounds
- [ ] Segurança
- [ ] Feature flags
- [ ] canal/cargo M47

## ❌ M41 — CRAZZY NOTIFY
- [ ] DM Discord
- [ ] compra aprovada
- [ ] key entregue
- [ ] cargo entregue
- [ ] tutorial liberado
- [ ] pagamento pendente
- [ ] alertas de falha

## ❌ M42 — CRAZZY PWA
- [ ] install
- [ ] cache
- [ ] offline states
- [ ] manifest

---

# NOVOS MÓDULOS DE SISTEMA

## ❌ M43 — CRAZZY FULFILLMENT ENGINE
- [ ] confirmar pagamento
- [ ] confirmar valor
- [ ] criar entitlement
- [ ] entregar key/conta/link/serviço
- [ ] liberar tutorial
- [ ] solicitar cargo
- [ ] registrar evidência
- [ ] notificar
- [ ] retry
- [ ] idempotência
- [ ] logs

## ❌ M44 — CRAZZY DISCORD BRIDGE
- [ ] bot/site sync
- [ ] guild
- [ ] user mapping
- [ ] product -> role
- [ ] grant
- [ ] revoke
- [ ] retry
- [ ] reconcile
- [ ] cor/prioridade
- [ ] profile role snapshot

## ❌ M45 — CRAZZY TUTORIAL STUDIO
- [ ] criar/editar/duplicar
- [ ] draft/publicado
- [ ] preview
- [ ] versionamento
- [ ] produto/plano
- [ ] regras de acesso
- [ ] seções/passos
- [ ] drag/drop
- [ ] mídia
- [ ] caixas coloridas
- [ ] keybinds
- [ ] anexos
- [ ] ordenação

## ❌ M46 — CRAZZY PARTNER: MT SOUNDS
- [ ] source/repo
- [ ] módulo isolado
- [ ] App Shell
- [ ] mesma URL/ecossistema
- [ ] migração final

## ❌ M47 — CRAZZY SECURITY SENTINEL
- [ ] logs estruturados
- [ ] bugs críticos/5xx
- [ ] tentativa admin sem permissão
- [ ] tentativa de visualizar estoque/keys sem autorização
- [ ] force endpoint admin
- [ ] price/payload tamper
- [ ] webhook signature inválida
- [ ] replay webhook
- [ ] brute/repeated login attempts
- [ ] rate limit
- [ ] enumeração de recursos
- [ ] privilege escalation attempt
- [ ] LZT security events
- [ ] PurinCash security events
- [ ] Fulfillment failures
- [ ] Discord sync failures
- [ ] stock conflicts/divergence
- [ ] refund/chargeback sensitive events
- [ ] severidade INFO/WARN/HIGH/CRITICAL
- [ ] request correlation id
- [ ] painel de auditoria
- [ ] alertas bot Discord
- [ ] canal configurável
- [ ] cargo de segurança configurável
- [ ] cooldown/agregação anti-spam
- [ ] deduplicação
- [ ] acknowledge/resolution
- [ ] mascaramento de IP/dados
- [ ] sem secrets/keys em logs
- [ ] retenção configurável
- [ ] acesso admin restrito
- [ ] Discord fora não derruba fluxo principal

---

# DECISÕES D01-D10 APROVADAS

- [x] D01 Keys híbridas; internal_stock padrão
- [x] D02 Roles no formato emoji | PRODUTO
- [x] D03 Cargo expira; histórico/key entregue permanece; tutorial permanece após expiração normal
- [x] D04 Reaproveitar bot CRAZZY saudável com serviço de sync isolado
- [x] D05 PurinCash como gateway; site como fonte de verdade
- [x] D06 Tutorial por produto/plano; upload + link/embed; permanece após expiração normal
- [x] D07 Estratégia MT Sounds fechada; source/repo continua dependência do M46
- [x] D08 Refund/dispute revoga entitlement/cargo/novos acessos e mantém evidências
- [x] D09 Cor do nick = maior role visível
- [x] D10 #security-logs privado; ping somente role configurada em CRITICAL

---

# PRÓXIMA SEQUÊNCIA

- [x] fechar decisões D01-D10
- [x] mergear PR #6 M05
- [x] mergear PR #7 Architecture V2
- [x] criar branch m06-accounts-market
- [x] construir adapter oficial LZT multijogo\n- [ ] configurar primeiro token LZT do usuário e validar provider
- [x] M07 concluído
- [x] M08 concluído estruturalmente
- [x] M09 concluído estruturalmente
- [x] M10 concluído
- [x] M11 concluído e mergeado
- [x] iniciar M12 — CRAZZY PROFILE


## CONTINUIDADE ATUAL
- [x] M11 concluído e mergeado
- [x] M12 concluído e mergeado
- [x] iniciar M13 — CRAZZY SUPPORT
- [x] M13 implementado tecnicamente
- [ ] concluir QA/merge M13 — CRAZZY SUPPORT
- [ ] iniciar M14 — CRAZZY COMMUNITY


## CONTINUIDADE M14
- [x] M13 concluído e mergeado
- [x] iniciar M14 — CRAZZY COMMUNITY
- [ ] concluir M14 — CRAZZY COMMUNITY
- [ ] iniciar M15 — CRAZZY REVIEWS
