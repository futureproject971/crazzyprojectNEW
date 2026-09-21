# M11 — CRAZZY LIBRARY

Status: **implementação funcional concluída; QA final/PR pendentes neste branch.**

## Objetivo

A CRAZZY LIBRARY é o único caminho de cliente para revelar conteúdo sensível já entregue.

Conteúdo sensível inclui:
- keys;
- credenciais de conta;
- links privados;
- trials/recompensas;
- payloads digitais manuais.

## Separação de dados

### public.library_deliveries
Metadata segura:
- user
- tipo da entrega
- produto/plano
- entitlement
- fonte da entrega
- status
- delivered/expires
- reveal_count
- last_revealed_at
- metadata segura

Authenticated:
- SELECT somente da própria linha ou admin via RLS.
- sem INSERT/UPDATE/DELETE direto.

### private.library_delivery_secrets
Payload real.

Campos:
- delivery_id
- payload
- payload_format
- created_at
- updated_at

Regras:
- schema privado;
- anon sem acesso;
- authenticated sem acesso;
- somente backend/service_role.

Nenhum client/browser consulta esta tabela diretamente.

### public.library_reveal_events
Auditoria:
- reveal
- copy

Nunca registra:
- key
- senha
- login
- token
- link privado
- conteúdo revelado.

## Stock legado

`stock_items.content` continua necessário para:
- estoque/admin;
- fulfillment existente.

Mas a antiga policy:
`Stock visible after delivery or to admin`

foi removida.

Agora SELECT de stock para authenticated passa somente pela policy admin.

O cliente recebe o payload somente pelo reveal autorizado da Library.

## Reward legado

`reward_deliveries.content` não é mais legível pelo owner via RLS.

A Edge Function `rewards` v5 também deixou de retornar `content` na action status.

O trigger do M11 sincroniza reward metadata + secret para a Library.

## claim_paid_delivery

A função existente foi auditada e preservada.

Ela já usa:
- payment coordinates para idempotência;
- FOR UPDATE SKIP LOCKED;
- rollback do bloco em unique_violation;
- service_role-only EXECUTE.

O M11 não reescreveu esta concorrência.

Um trigger pós-order_ticket sincroniza o stock entregue para a Library.

## Triggers

### private.sync_order_ticket_library_delivery
Quando um ticket com stock chega a estado entregue:
- lê stock apenas no backend;
- cria/atualiza metadata Library;
- salva secret no schema private;
- LZT vira tipo account;
- produto comum vira tipo key.

### private.sync_reward_library_delivery
Quando reward é entregue:
- associa reward_session ao produto/plano;
- cria metadata Library;
- salva payload no schema private;
- preserva expiração.

## Reveal

RPC service-only:
`library_reveal_owned_delivery`

Valida:
- delivery id;
- user ownership;
- status;
- expiração;
- entitlement bloqueado por revoke/refund/dispute;
- existência do secret.

Se autorizado:
- incrementa reveal_count;
- atualiza last_revealed_at;
- registra evento reveal;
- devolve somente o payload daquela entrega.

Authenticated NÃO possui EXECUTE direto.

## Copy

RPC:
`library_record_copy_event`

Service-role only.

Registra apenas o evento.

O browser NÃO envia o secret para auditoria.

## Edge Function

`library` v1

Actions:
- GET `?action=snapshot`
- POST `?action=reveal`
- POST `?action=copy-event`

A função:
- valida JWT Supabase;
- bloqueia usuário banido;
- usa user id derivado da sessão;
- aplica rate limit de reveal;
- não loga payload.

## Next.js

Rotas:
- `/biblioteca`
- `/painel/biblioteca` -> alias
- `/api/library`
- `/api/library/reveal`
- `/api/library/copy-event`

`/biblioteca` é protegida pelo middleware M09.

## Plaintext no browser

O payload:
- não vai para localStorage;
- não vai para sessionStorage;
- não vai para IndexedDB;
- não vai para cookie;
- não vai para URL;
- não é persistido.

A UI mantém no máximo UMA entrega revelada em React state.

Ao:
- ocultar;
- revelar outro item;
- trocar aba;
- recarregar/navegar;

o plaintext anterior deixa o state.

## Client Hub

M10 continua sendo resumo/status.

A aba Entregas agora aponta para:
`/biblioteca`

M10 não recebe conteúdo sensível.

## LZT

PurinCash/fulfillment v6 foi ajustado:
- não envia mais credenciais em ticket_messages;
- ticket informa que a conta está na Library;
- stock item continua alimentando o trigger seguro.

LZT continua desligado até ativação futura.

## Tutorial

Fulfillment deixou de publicar tutorial/arquivo sensível no ticket.

O ticket apenas informa que há tutorial associado.

M22 CRAZZY ACADEMY continua responsável pelo viewer protegido.

## Rewards

Rewards v5:
- continua gerando delivery normalmente;
- action status não retorna plaintext;
- Library é o caminho de reveal.

## Segurança

Confirmado:
- anon não possui SELECT em Library/stock/reward;
- authenticated não possui SELECT em private.library_delivery_secrets;
- authenticated não possui EXECUTE das RPCs de reveal/copy;
- service_role possui EXECUTE;
- Security Advisor Supabase: 0 lints após migrations.

## Migrations

- `m11_library_secure_reveal`
- `m11_library_account_payload_format`

## Próximo módulo

Somente após QA + PR + merge do M11:
- M12 — CRAZZY PROFILE.
