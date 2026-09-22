# CRAZZY PROJECT — Module Status

## M00 — CRAZZY DESIGN SYSTEM
Status: **APROVADO E INTEGRADO**

QA:
- typecheck: PASS
- build: PASS
- GitHub Actions: PASS

---

## M01 — CRAZZY APP SHELL
Status: **APROVADO E INTEGRADO**

Merged into `phase-1-home`:
`e52fc62a8ccb388cf5a28a39ec708d8152dd3d0f`

QA:
- typecheck: PASS
- build: PASS
- GitHub Actions: PASS

---

## M02 — CRAZZY HOME
**GRUPO 01 — EXPERIÊNCIA PÚBLICA**

Status: **CONCLUÍDO / QA TÉCNICO PASS**

Branch:
`m02-home`

Implementado até agora:
- Home modular em `src/modules/home`
- Hero reconstruído em camadas reais
- wallpaper HD separado
- logo oficial grande separada e em alta resolução
- tagline real
- pilares do Hero
- CTAs reais
- BenefitsBar preservada
- preview Feedbacks
- preview Chat Geral
- preview Ticket
- bloco Por que escolher a CRAZZY
- Produtos em Destaque / coverflow
- crops reais dos produtos existentes
- Explore Nossa Loja
- Footer fornecido pelo M01
- responsividade desktop/tablet/mobile

Correções críticas concluídas:
- removida dependência visual do wallpaper de ~5 KB pixelado
- logo deixou de ser parte implícita do wallpaper
- Hero agora é background + logo + textos + CTAs independentes

QA técnico:
- CI anterior do módulo: PASS
- typecheck: PASS
- build: PASS
- GitHub Actions: PASS

Próximo módulo após M02:
**M03 — CRAZZY DISCOVERY**


---

## M03 — CRAZZY DISCOVERY
**GRUPO 01 — EXPERIÊNCIA PÚBLICA**

Status: **APROVADO E INTEGRADO**

Branch:
`m03-discovery`

Rotas:
- `/novidades`
- `/categorias`
- `/destaques`

QA:
- typecheck: PASS
- build: PASS
- GitHub Actions: PASS

Implementado:
- busca mock
- categorias
- filtros
- tags
- novidades
- mais vendidos
- destaques
- lançamentos
- loading
- empty
- error
- responsividade
- integração mínima com Home/AppShell

Próximo módulo previsto após aprovação:
**M04 — CRAZZY CATALOG**


---

## M04 — CRAZZY CATALOG
**GRUPO 02 — COMÉRCIO**

Status: **APROVADO E INTEGRADO**

Branch:
`m04-catalog`

Rota:
- `/produtos`

Implementado:
- grid de produtos
- busca
- filtros combináveis
- categorias
- ordenação
- badges
- estoque visual
- novos
- mais vendidos
- promoções
- paginação
- loading
- empty state
- error state
- responsividade desktop/tablet/mobile
- integração mínima com Home/AppShell

QA:
- typecheck: PASS
- build: PASS
- GitHub Actions: PASS

Próximo módulo previsto após aprovação:
**M05 — CRAZZY PRODUCT VIEW**


---

## M05 — CRAZZY PRODUCT VIEW
**GRUPO 02 — COMÉRCIO**

Status: **CONCLUÍDO / AGUARDANDO APROVAÇÃO DO USUÁRIO**

Branch:
`m05-product-view`

Rota:
- `/produto/[slug]`

Implementado:
- galeria e thumbnails
- zoom
- metadata por produto
- not-found por slug
- badges e estoque
- planos e seleção
- CTA visual
- benefícios
- descrição
- compatibilidade e requisitos
- avaliações
- FAQ
- produtos relacionados
- Home coverflow ligado ao Product View
- loading / error
- desktop / tablet / mobile

QA:
- typecheck: PASS
- build: PASS
- GitHub Actions: PASS

Próximo módulo previsto após aprovação:
**M06 — CRAZZY ACCOUNTS**

---

## 2026-09-22 — ESTADO ATUAL DO PROJETO

- M25 Product Manager: integrado na main.
- M26 Category Manager: integrado na main.
- M27 Stock Manager: integrado na main.
- M28 Sales Manager: integrado na main.
- Visual global de cards premium: integrado na main, preservando mídias/artes.
- CRAZZY CALL: transplantado para a base atual na branch `m-discord-campaigns`.
- CRAZZY Community: dock de voz/vídeo/tela conectado ao CRAZZY CALL na branch `m-discord-campaigns`.
- Discord Campaign Center: editor, preview, templates, fila, público, agendamento, teste, progresso e histórico na branch `m-discord-campaigns`.
- Unified Discord Bot: bot-core único criado em `apps/discord-bot` com 1 token/1 worker Discloud.
- Módulo Campaigns do bot único: implementado.
- Próximas migrações para o mesmo bot: roles, notify, support e security alerts.
- PR atual: #43.

Bloqueios externos atuais:
- Vercel continua reportando `build-rate-limit`.
- CRAZZY CALL ainda precisa das credenciais LiveKit reais para teste de mídia ponta a ponta.
- Unified Discord Bot precisa receber as variáveis da aplicação Discloud antes do teste ao vivo.
