# M13 — CRAZZY SUPPORT

Status: **implementado; QA final/PR pendentes neste branch.**

## Objetivo

Criar suporte real para clientes sem reutilizar o fluxo de fulfillment.

O módulo suporta:
- tickets privados;
- mensagens em thread;
- imagem;
- vídeo;
- áudio;
- PDF/TXT;
- contexto opcional de compra/produto/entitlement/Library;
- status e histórico;
- fechar/reabrir.

## Separação de domínios

### NÃO reutilizar como suporte genérico

`order_tickets` e `ticket_messages` pertencem à entrega/fulfillment.

M13 usa:
- `support_tickets`
- `support_messages`
- `support_attachments`
- `support_ticket_events`

Um ticket M13 pode referenciar `order_tickets`, mas não muda a semântica dele.

## Banco

### support_tickets

Campos principais:
- user_id
- category
- subject
- status
- priority
- product_id
- product_plan_id
- entitlement_id
- order_ticket_id
- library_delivery_id
- assigned_to
- last_message_at
- closed_at

Categorias:
- product
- payment
- delivery
- technical
- account
- other

Status:
- open
- waiting_staff
- waiting_user
- resolved
- closed

Prioridades:
- low
- normal
- high
- urgent

No fluxo cliente, a prioridade inicial é definida pelo backend como `normal`.

### support_messages

- ticket_id
- sender_id
- sender_role
- message
- edited_at
- created_at

sender_role:
- user
- staff
- system

### support_attachments

Metadata somente:
- ticket
- message
- owner
- storage path
- filename
- MIME
- tamanho
- status

Não armazena o binário no Postgres.

### support_ticket_events

Auditoria sem segredo:
- created
- message
- attachment
- status_changed
- closed
- reopened
- assigned

## Escrita

O browser NÃO possui INSERT/UPDATE/DELETE direto nas tabelas Support.

Authenticated tem somente SELECT conforme RLS.

Todas as mutações passam pela Edge Function `support`.

Isso impede o cliente de:
- trocar user_id;
- se autoatribuir como staff;
- definir assigned_to;
- forçar prioridade;
- escrever status arbitrário.

## RLS

Owner:
- lê somente ticket próprio;
- lê mensagens/anexos/eventos do próprio ticket.

Admin/mod:
- pode ler tickets e contexto para atendimento.

Escrita permanece backend-only no M13.

## Edge Function support

Versão inicial: v1.

Actions:
- GET snapshot
- POST create
- GET thread
- POST message
- POST close
- POST reopen
- POST upload-url
- POST finalize-attachment

Toda action:
- valida JWT Supabase;
- deriva user id da sessão;
- bloqueia usuário banido;
- nunca confia em user_id vindo do browser.

## Contexto comercial

Ao criar ticket, o cliente pode referenciar:
- entitlement;
- order ticket;
- Library delivery;
- produto/plano.

O backend valida ownership e deriva produto/plano do contexto autoritativo.

O ticket NÃO recebe:
- key;
- senha;
- token;
- payload da Library;
- checkout proof;
- HMAC;
- credencial LZT.

## Storage

Bucket:
`support-attachments`

Configuração:
- private;
- 25 MB por arquivo;
- sem policy pública;
- uploads por signed upload URL;
- downloads por signed URL de 5 minutos após authorization.

MIME permitido:
- PNG
- JPEG
- WEBP
- GIF
- MP4
- WEBM
- MP3/MPEG
- OGG
- áudio WEBM
- PDF
- TXT

Executáveis e arquivos arbitrários não são aceitos por padrão.

## Upload

Fluxo:
1. criar mensagem/ticket;
2. pedir signed upload URL ao backend;
3. backend valida ticket, sessão, MIME, tamanho e limites;
4. browser envia direto ao Supabase Storage via token assinado;
5. browser chama finalize;
6. backend confirma objeto;
7. metadata vira ready;
8. thread devolve signed download URL curta.

Service role nunca vai para o browser.

## Limites

- até 10 novos tickets/hora por usuário;
- até 30 mensagens/minuto por usuário;
- até 20 anexos por ticket;
- UI limita 5 anexos por mensagem;
- 25 MB por arquivo.

## UI

Rotas:
- `/tickets`
- `/tickets/novo`
- `/tickets/[id]`

Recursos:
- resumo de tickets;
- status;
- nova solicitação;
- categoria;
- contexto opcional;
- anexos;
- thread estilo chat;
- imagens;
- vídeo;
- áudio;
- PDF/TXT;
- fechar;
- reabrir;
- histórico de eventos.

A thread usa polling seguro de 6 segundos quando a aba está visível.

Realtime fica opcional para evolução futura. Segurança não depende dele.

## Boundaries

M13:
- experiência cliente.

M32:
- fila operacional/admin;
- assignment;
- SLA;
- gestão de staff.

M11:
- reveal de segredos.

M22:
- tutorial protegido.

M43:
- fulfillment.

M47:
- logging/alertas de segurança.

## Segurança

Após migration:
- anon sem SELECT nas tabelas Support;
- authenticated sem INSERT direto;
- authenticated sem UPDATE direto;
- authenticated sem DELETE direto;
- bucket privado;
- Security Advisor: 0 lints.

## Performance

Índices cobrem:
- user/status/priority;
- assigned_to;
- produto/plano;
- entitlement;
- order ticket;
- Library delivery;
- message_id de attachment;
- attachment owner;
- event actor.

## Próximo módulo

Somente após QA + PR + merge:
- M14 — CRAZZY COMMUNITY.
