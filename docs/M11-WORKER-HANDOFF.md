# M11 — CRAZZY LIBRARY — HANDOFF IMEDIATO

Data do handoff: 2026-09-21

## Estado atual
Branch atual:
- `m11-library`

Base:
- `phase-1-home`

M11 foi iniciado, MAS ainda não foi implementado no frontend/backend.

### Já feito no início do M11
- branch `m11-library` criada;
- checklist master carregado;
- auditoria do Supabase iniciada;
- tabelas relacionadas a entrega/estoque/library mapeadas;
- policies RLS lidas;
- função `claim_paid_delivery` identificada;
- problema de exposição direta de conteúdo sensível identificado.

## Banco já existente relevante

### public.stock_items
Campos:
- id
- product_plan_id
- content
- used
- used_at
- created_at

Observação crítica:
- policy atual permite SELECT do stock item pelo dono DEPOIS que existir order_ticket entregue/resolved/closed/finished/archived;
- isso significa que o cliente consegue ler `content` diretamente pela REST quando a policy deixa;
- isso conflita com a arquitetura M11 de revelação sob demanda.

### public.trial_stock_items
Campos:
- id
- product_plan_id
- content
- duration_minutes
- used
- used_by
- used_at
- created_at

Policy atual:
- somente admin gerencia;
- cliente não possui leitura direta.

### public.reward_deliveries
Campos:
- id
- session_id
- user_id
- trial_stock_item_id
- content
- delivery_mode
- delivered_by
- delivered_at
- expires_at
- created_at

Observação crítica:
- owner pode SELECT da própria linha;
- como `content` fica na própria tabela, isso expõe conteúdo diretamente pela API/RLS;
- M11 deve separar listagem segura de revelação segura.

### public.order_tickets
Campos relevantes:
- id
- user_id
- product_id
- product_plan_id
- stock_item_id
- status
- status_label
- metadata
- payment_id
- payment_item_index
- payment_unit_index

Policies:
- owner/admin podem SELECT;
- escrita normal é admin/backend.

### public.entitlements
Criada no M10.

Campos:
- id
- user_id
- product_id
- product_plan_id
- source_payment_id
- source_order_ticket_id
- fulfillment_key
- status
- starts_at
- expires_at
- tutorial_access
- metadata
- created_at
- updated_at

M11 deve usar entitlement/status, mas NÃO alterar o modelo de concessão.
M43 é o escritor autoritativo de entitlements.

### public.lzt_sales
Campos:
- id
- lzt_item_id
- buy_price
- sell_price
- profit
- account_title
- buyer_user_id
- sold_at

Policy atual:
- admin only.

Importante:
- não há credencial/account secret armazenado nesta tabela hoje;
- quando LZT real for ativado, M11 deverá mostrar somente entrega já persistida por backend seguro;
- não consultar credencial bruta diretamente do browser.

### public.payments
Já possui:
- checkout proof;
- cart snapshot;
- checkout_payload;
- idempotency_key;
- payment_method.

M11 NÃO deve expor:
- cart_snapshot bruto;
- checkout proof;
- charge metadata sensível;
- HMAC/proofs.

## Funções relevantes identificadas
- `claim_paid_delivery(payment_id, user_id, product_id, product_plan_id, item_index, unit_index)`
- `private.has_role`
- outras funções não relacionadas não mexer agora.

## PROBLEMA DE SEGURANÇA ACHADO

### Problema 1 — stock_items
A policy:
`Stock visible after delivery or to admin`

permite o cliente fazer SELECT direto do `stock_items.content` após a entrega.

Para M11 isso precisa mudar.

Arquitetura desejada:
- listagem da Library NÃO devolve content;
- revelação só via endpoint server-side;
- endpoint valida usuário;
- valida order/entitlement;
- valida status;
- registra evento de reveal;
- retorna conteúdo somente naquela chamada;
- nunca listar content em snapshot normal.

### Problema 2 — reward_deliveries
O owner lê a linha própria e, portanto, recebe `content`.

M11 deve parar de depender de SELECT direto nessa tabela para dados sensíveis.

Opções aceitáveis:
1. mover conteúdo secreto para tabela privada/secure payload;
2. ou revogar SELECT direto e expor apenas view/API segura;
3. preferência atual: separar metadata/status público de payload secreto e revelar via função/Edge/Route server-side.

## Arquitetura M11 definida até aqui

M11 — CRAZZY LIBRARY deve ter:

### Página
- `/biblioteca`
- alias opcional futuro: `/painel/biblioteca`

### Tabs/áreas
- Minhas Keys
- Minhas Contas
- Links/Downloads
- Trials/Recompensas quando aplicável
- Histórico de revelações
- status do produto
- status do entitlement
- status Discord/cargo relacionado
- acesso ao tutorial vinculado, sem expor conteúdo do tutorial

### Listagem segura
Mostrar:
- produto
- plano
- status
- data da compra
- data da entrega
- expiração
- tipo da entrega
- se já foi revelado
- último reveal
- quantidade de reveals permitidos/registrados

NÃO mostrar na listagem:
- key
- login
- senha
- token
- link privado
- conteúdo da recompensa
- proof/HMAC
- cart snapshot
- provider secret

### Reveal seguro
Ação explícita:
- usuário clica Revelar;
- backend valida sessão;
- backend valida ownership;
- backend valida entitlement/order;
- backend valida delivery status;
- registra auditoria;
- retorna payload apenas naquela resposta.

A UI pode:
- revelar temporariamente;
- botão copiar;
- mascarar novamente;
- registrar timestamp local da última revelação;
- nunca persistir plaintext em localStorage.

### Histórico
Criar tabela dedicada tipo:
`library_reveal_events`

Campos sugeridos:
- id
- user_id
- delivery_type
- delivery_ref_id
- entitlement_id
- action: reveal/copy
- created_at
- metadata mínima sem segredo

RLS:
- owner lê seus eventos;
- admin lê todos;
- cliente não insere direto;
- API backend registra.

### Payload seguro
Criar camada dedicada, preferencialmente:
- `delivery_secrets` / `library_delivery_secrets`
ou equivalente.

Campos:
- id
- delivery_type
- delivery_ref_id
- user_id
- ciphertext/plain payload server-only
- created_at
- updated_at

IMPORTANTE:
- anon/authenticated NÃO podem SELECT direto;
- somente service role / backend;
- se possível criptografar em aplicação com secret server-side;
- browser nunca lê tabela diretamente.

## Boundaries com outros módulos

M10:
- continua somente status/resumo;
- NÃO deve revelar conteúdo.

M11:
- revela keys/contas/links com auditoria.

M22 Academy:
- viewer protegido de tutorial.

M43 Fulfillment:
- cria/atualiza delivery + entitlement.

M44 Discord Bridge:
- grants/revokes roles.

## Próximos passos EXATOS

1. Continuar auditoria da função `claim_paid_delivery`.
2. Conferir GRANTs diretos de:
   - stock_items
   - reward_deliveries
   - order_tickets
   - trial_stock_items
3. Desenhar migration M11:
   - tabela de segredo;
   - tabela reveal_events;
   - remover SELECT sensível direto;
   - manter status/listagem via tabelas seguras/view.
4. Criar API segura:
   - GET library snapshot sem payload;
   - POST reveal;
   - POST copy event opcional.
5. Criar `/biblioteca`.
6. Ligar ao Client Hub M10.
7. Smoke tests:
   - anon bloqueado;
   - owner não consegue ler secret table;
   - owner consegue listar status;
   - reveal exige sessão;
   - reveal de item de outro usuário = 403/404;
   - reveal válido retorna apenas o próprio payload.
8. Security Advisor Supabase.
9. TypeScript.
10. Production build.
11. PR M11.
12. Merge.
13. Próximo módulo após merge do M11: M12 — CRAZZY PROFILE.

## NÃO FAZER
- não colocar secret/key em localStorage;
- não expor stock_items.content via API normal;
- não usar service role no browser;
- não inventar payload de LZT;
- não ativar LZT/PurinCash secrets agora;
- não mexer no M43 fulfillment além do necessário para contrato;
- não revelar tutorial protegido no M11;
- não misturar Library com Support Desk ou Community.

## Estado dos módulos anteriores
- M06 Accounts Market: concluído estruturalmente
- M07 Cart + Combo: concluído
- M08 Checkout: concluído estruturalmente
- M09 Auth: concluído estruturalmente
- M10 Client Hub: concluído
- M11 Library: INICIADO, PAROU NA AUDITORIA DE SEGURANÇA DO BANCO


## CHECKLIST É A FONTE DE STATUS

Antes de continuar, o Worker deve ler:
1. `docs/CHECKLIST-MASTER.md`
2. este arquivo `docs/M11-WORKER-HANDOFF.md`
3. `docs/00_CONTINUE_NEXT_CHAT.md`

O checklist master foi atualizado especificamente para o M11 e separa:
- auditoria já concluída;
- bloqueios críticos;
- backend seguro;
- Library UI;
- QA obrigatório.

Não marcar item como concluído sem executar/verificar.

## REGRA DE CONTINUIDADE PARA O WORKER

Começar EXATAMENTE no passo 1 dos próximos passos:
- terminar auditoria de `claim_paid_delivery`;
- depois conferir GRANTs;
- só então criar migration de secrets/reveal.

Não criar primeiro uma tela bonita e depois tentar proteger.
Segurança do payload vem antes da UI.

Quando M11 estiver 100% verde:
- atualizar CHECKLIST-MASTER;
- atualizar 00_CONTINUE_NEXT_CHAT;
- abrir PR;
- mergear;
- iniciar M12 CRAZZY PROFILE apenas depois.


## AUDITORIA CLAIM_PAID_DELIVERY — CONCLUÍDA

A função `public.claim_paid_delivery` foi lida integralmente.

Conclusões:
- usa caminho rápido de idempotência por:
  - payment_id
  - payment_item_index
  - payment_unit_index
- seleciona estoque com:
  - `FOR UPDATE SKIP LOCKED`
- marca o item como usado dentro da mesma transação;
- cria order_ticket com coordenadas de pagamento;
- em corrida de `unique_violation`, o bloco interno reverte a mutação de estoque e recupera o ticket vencedor;
- risco de duas entregas consumirem o MESMO stock item está mitigado corretamente;
- execute da função:
  - anon: false
  - authenticated: false
  - service_role: true

Portanto:
- NÃO reescrever a lógica de claim sem necessidade;
- o problema do M11 está na exposição pós-entrega do plaintext.

## AUDITORIA GRANTS/RLS — CONCLUÍDA

Confirmado:
- `stock_items`: authenticated possui SELECT/INSERT/UPDATE/DELETE em grant, mas RLS restringe mutações a admin; policy de SELECT permite owner ler stock após delivery, incluindo `content`.
- `reward_deliveries`: owner pode SELECT da própria linha, incluindo `content`.
- `trial_stock_items`: somente admin passa pela policy.
- `order_tickets`: owner/admin SELECT; mutações comuns restritas por policy.
- `entitlements`: authenticated SELECT da própria linha/admin.
- `lzt_sales`: grants amplos existem, mas policy ALL é admin-only.
- `payments`: authenticated SELECT da própria linha/admin; escrita protegida.

Próximo passo:
- migration M11 para retirar exposição direta de payload sensível sem quebrar claim_paid_delivery.


## M11 IMPLEMENTAÇÃO — CONCLUÍDA TECNICAMENTE

Implementado no branch `m11-library`:

### Banco
- `public.library_deliveries`
- `private.library_delivery_secrets`
- `public.library_reveal_events`
- triggers de sync para order_tickets + rewards
- reveal RPC service-only
- copy audit RPC service-only
- antigas policies de owner sobre stock/reward plaintext removidas

### Backend
- Edge Function `library` v1
- Edge Function `rewards` v5 sem plaintext em status
- Edge Function `purincash-payment` v6 sem credenciais LZT/tutorial sensível em ticket

### Next/UI
- /biblioteca
- /painel/biblioteca -> redirect
- /api/library
- /api/library/reveal
- /api/library/copy-event
- middleware protege /biblioteca
- menu da conta aponta para Library
- Client Hub aponta para Library
- reveal/copy/ocultar/histórico
- plaintext somente em React state temporário

### QA já concluído
- npm ci PASS
- TypeScript PASS
- production build PASS
- smoke M11 PASS
- validação isolada GitHub Actions PASS
- Supabase Security Advisor: 0 lints

### Falta apenas
- CI oficial no head final após docs/limpeza
- abrir PR
- mergear PR
- atualizar docs pós-merge
- iniciar M12 CRAZZY PROFILE
