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
13. Próximo módulo: M12 — CRAZZY COMMUNITY.

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
