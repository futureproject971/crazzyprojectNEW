# CRAZZY PROJECT — MASTER CHECKLIST

Última atualização: 2026-09-21

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

## 🟡 M06 — CRAZZY ACCOUNTS MARKET — EM ANDAMENTO
Fonte: FortuneECrazzy + LZT.

- [x] migrar listagem (VALORANT/LZT)
- [x] migrar detalhes (provider read-only)
- [x] Valorant
- [ ] LoL
- [ ] Fortnite
- [ ] Minecraft
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

### QA M06 — corte VALORANT
- [x] API pública somente leitura via Next
- [x] token LZT não exposto
- [x] fast-buy não exposto
- [x] TypeScript PASS
- [x] Next production build PASS
- [x] GitHub Actions PASS
- [ ] LoL via adapter multijogo
- [ ] Fortnite via adapter multijogo
- [ ] Minecraft via adapter multijogo
- [ ] preço comercial/markup validado
- [ ] compra/entrega LZT integrada ao M43

## ❌ M07 — CRAZZY CART
- [ ] carrinho
- [ ] produto
- [ ] conta
- [ ] plano
- [ ] quantidade
- [ ] cupom
- [ ] subtotal
- [ ] desconto
- [ ] total
- [ ] carrinho rápido
- [ ] página completa

## ❌ M08 — CRAZZY CHECKOUT
- [ ] PIX PurinCash
- [ ] cartão PurinCash
- [ ] LTC PurinCash
- [ ] QR/copia e cola
- [ ] checkout hospedado
- [ ] endereço LTC
- [ ] expiração/status
- [ ] webhook
- [ ] HMAC
- [ ] idempotência
- [ ] polling
- [ ] value check
- [ ] anti-entrega-duplicada

## ❌ M09 — CRAZZY AUTH
- [ ] Discord OAuth/link
- [ ] Discord user id
- [ ] guild status
- [ ] Google opcional
- [ ] sessão segura
- [ ] recuperação
- [ ] roles

## ❌ M10 — CRAZZY CLIENT HUB
- [ ] overview
- [ ] pedidos
- [ ] produtos ativos
- [ ] entitlements
- [ ] cargos
- [ ] tutoriais liberados
- [ ] entregas
- [ ] sync Discord

## ❌ M11 — CRAZZY LIBRARY
- [ ] keys
- [ ] contas
- [ ] links
- [ ] revelar/copiar
- [ ] histórico
- [ ] tutorial associado
- [ ] status cargo
- [ ] reconsulta segura

## ❌ M12 — CRAZZY PROFILE
- [ ] avatar
- [ ] Discord conectado
- [ ] cargos
- [ ] badges
- [ ] cor principal
- [ ] perfil estilo Discord

## ❌ M13 — CRAZZY SUPPORT
- [ ] ticket real
- [ ] imagem
- [ ] vídeo
- [ ] áudio
- [ ] arquivos
- [ ] contexto produto/pedido/key
- [ ] entitlement
- [ ] tutorial relacionado

## ❌ M14 — CRAZZY COMMUNITY
- [ ] chat real
- [ ] perfil clicável
- [ ] cargos
- [ ] cor do cargo principal
- [ ] badges
- [ ] reações
- [ ] respostas
- [ ] sync Discord

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

## ❌ M29 — CRAZZY PAYMENTS
- [ ] PIX
- [ ] cartão
- [ ] LTC
- [ ] webhooks
- [ ] transações
- [ ] reembolso
- [ ] disputes
- [ ] evidências
- [ ] reconciliação

## ❌ M30 — CRAZZY FINANCE
- [ ] receita
- [ ] taxas
- [ ] líquido
- [ ] reembolso
- [ ] chargeback
- [ ] gateway fees

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
- [ ] migrar Fortune/LZT
- [ ] seguir M07 -> M08 -> M09...
