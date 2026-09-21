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
- tecnicamente concluído
- branch: m05-product-view
- PR #6 aberto
- QA: typecheck PASS / build PASS / GitHub Actions PASS
- ainda NÃO mergeado porque a conversa desviou para auditoria/arquitetura

### Arquitetura V2
- branch: architecture-v2-integrations
- PR #7 aberto
- inclui atualização completa para:
  - PurinCash
  - Discord Bridge
  - Entitlements
  - Fulfillment
  - Tutorial Studio
  - Pink/Fortune/IFOOD migration matrix
  - MT Sounds parceiro
  - novos módulos M43-M46

### M06
- NÃO iniciado
- deve ser migração do sistema de contas/LZT existente no FortuneECrazzy
- NÃO recriar LZT do zero

## FONTES ANTIGAS AUDITADAS

### FortuneECrazzy.rar
Fonte preferida para:
- Accounts Market
- LZT
- Valorant
- LoL
- Fortnite
- Minecraft
- filtros
- rank
- skins
- inventário
- region
- markup
- detalhes de conta

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

## PERGUNTAS PENDENTES DO USUÁRIO

Antes do backend definitivo fechar:

1. Keys:
   - interno Supabase?
   - PurinCash supplier?
   - híbrido?
   Recomendação: híbrido, internal_stock como padrão.

2. Nome das roles:
   - "Cliente • PRODUTO • emoji"
   - ou "emoji | PRODUTO"
   Recomendação: "emoji | PRODUTO".

3. Plano expirou:
   - remover cargo Discord?
   Recomendação: sim.

4. Tutorial depois da expiração:
   - perde acesso ou mantém?
   Recomendação atual: manter tutorial, produto/licença expira.

5. Refund/chargeback:
   Recomendação:
   - revogar entitlement
   - remover cargo
   - bloquear novos downloads protegidos
   - manter histórico/logs

6. Discord bot:
   - reaproveitar bot CRAZZY atual?
   - ou bot separado?
   Recomendação: reaproveitar se código estiver saudável, mantendo serviço de sync isolado.

7. MT Sounds:
   - ainda falta source/repo.

8. Vídeo em tutorial:
   - upload direto?
   - YouTube/link?
   Recomendação: ambos.

## REGRA DO USUÁRIO SOBRE MIGRAÇÃO

Sempre que houver dúvida entre criar do zero ou migrar:
- procurar primeiro no Fortune, Pink, IFOOD 420 e MT Sounds
- dizer o que já existe
- recomendar migrar ou recriar
- perguntar ao usuário quando isso mudar comportamento/negócio

Pensar assim:
"os sites antigos vendiam a mesma coisa; se o recurso era útil antes, auditar antes de descartar."

## PRs ABERTOS

- PR #6 — M05 CRAZZY PRODUCT VIEW
- PR #7 — Architecture V2 — PurinCash, Discord, Tutorials, Fulfillment & MT Sounds

## PRÓXIMO PASSO CORRETO

NÃO começar M06 imediatamente.

Primeiro:
1. ler este arquivo e docs da Architecture V2
2. confirmar estado dos PRs #6 e #7
3. fechar as perguntas pendentes com o usuário
4. obter source/repo MT Sounds quando possível
5. após aprovação, mergear M05 e Architecture V2 na ordem segura
6. criar branch m06-accounts-market
7. migrar Fortune/LZT para CRAZZY PROJECT sem recriar do zero

## PROMPT CURTO PARA NOVA CONVERSA

"Abra o repo futureproject971/crazzyprojectNEW. Leia primeiro docs/00_CONTINUE_NEXT_CHAT.md na branch architecture-v2-integrations, depois docs/ROADMAP.md, docs/ARCHITECTURE-INTEGRATIONS.md, docs/SOURCE-MIGRATION-MATRIX.md, docs/M06-PREFLIGHT.md e docs/DECISIONS-BEFORE-M06.md. Verifique os PRs #6 e #7. Continue exatamente de onde paramos, sem recriar sistemas existentes e sem iniciar M06 antes de fechar as decisões pendentes comigo."
