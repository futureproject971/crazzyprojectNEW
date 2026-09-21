# M13 — CRAZZY SUPPORT — WORKER HANDOFF

Data: 2026-09-21

## REPO / BRANCH
- repo: `futureproject971/crazzyprojectNEW`
- base: `phase-1-home`
- branch atual: `m13-support`

## ESTADO DOS MÓDULOS
- M11 CRAZZY LIBRARY: mergeado no commit `d833cbef71175487bbf0c150217a8b32b2953ce1`
- M12 CRAZZY PROFILE: mergeado via PR #14 no commit `339fb34d4c466a34a23d5a78e23fc5bcaf62072d`
- M13 CRAZZY SUPPORT: INICIADO

## O QUE JÁ FOI FEITO NO M13
- branch `m13-support` criada a partir de `phase-1-home`;
- checklist carregado;
- auditoria inicial do Supabase feita;
- `order_tickets` e `ticket_messages` analisados;
- decisão técnica: NÃO usar `order_tickets` como tabela principal de suporte genérico;
- motivo: `order_tickets` pertence ao fluxo de entrega/pedido e já tem semântica de fulfillment;
- Storage auditado;
- bucket atual `game-images` é público e não deve receber anexos de suporte;
- documentação oficial Supabase verificada:
  - private buckets são privados por padrão;
  - downloads privados exigem JWT/RLS ou signed URL;
  - Storage usa RLS em `storage.objects`;
  - upsert precisa de INSERT + SELECT + UPDATE.

## DIREÇÃO ARQUITETURAL APROVADA
Criar Support separado, com vínculo opcional ao ecossistema comercial.

### Tabelas novas planejadas
- `support_tickets`
- `support_messages`
- `support_attachments`
- opcionalmente histórico/eventos se necessário

### support_tickets deve suportar
- id
- user_id
- category
- subject
- status
- priority
- product_id opcional
- product_plan_id opcional
- entitlement_id opcional
- order_ticket_id opcional
- library_delivery_id opcional
- tutorial/product context sem copiar conteúdo sensível
- assigned_to opcional para futuro M32
- created_at
- updated_at
- closed_at

### support_messages
- ticket_id
- sender_user_id
- sender_role ou origin
- message
- created_at
- edited_at opcional
- sem secrets automáticos

### support_attachments
- ticket_id
- message_id opcional
- owner_user_id
- storage_path
- filename
- mime_type
- size_bytes
- created_at

## STORAGE
Criar bucket PRIVADO exclusivo, sugestão:
- `support-attachments`

Nunca usar `game-images`.

Restrições sugeridas:
- private bucket;
- limite de tamanho razoável por arquivo;
- allowlist de MIME:
  - image/png
  - image/jpeg
  - image/webp
  - video/mp4
  - video/webm
  - audio/mpeg
  - audio/ogg
  - audio/webm
  - application/pdf
  - text/plain
  - application/zip quando realmente necessário

Antes de liberar ZIP/executáveis, revisar necessidade. Não permitir executáveis por padrão.

## RLS
Cliente:
- lê apenas tickets próprios;
- cria ticket próprio;
- lê mensagens dos próprios tickets;
- cria mensagem somente em ticket próprio e aberto;
- vê metadata de anexos dos próprios tickets;
- não altera user_id/assigned_to/staff role/status arbitrariamente.

Admin/mod:
- poderá ler/atender conforme `private.has_role`.

Storage:
- path deve começar pelo user/ticket correto;
- owner só acessa anexo pertencente a ticket próprio;
- admin/mod pode acessar para suporte;
- preferir download autenticado ou signed URL curto;
- nunca tornar bucket público.

## CONTEXTO DE COMPRA
Support pode receber contexto opcional de:
- produto;
- plano;
- pedido;
- entitlement;
- Library delivery;
- tutorial disponível.

NÃO deve copiar/expor:
- key;
- senha;
- token;
- payload privado da Library;
- HMAC/proof;
- credencial LZT.

Se o ticket precisar referenciar uma entrega:
- salvar somente o ID/referência;
- staff consulta contexto autorizado no backend.

## UI M13
Rotas planejadas:
- `/tickets`
- `/tickets/novo`
- `/tickets/[id]`

Recursos:
- lista de tickets;
- criar ticket;
- categoria;
- assunto;
- mensagem inicial;
- anexos;
- imagem/vídeo/áudio/arquivo;
- contexto opcional de compra/produto;
- thread;
- status;
- prioridade visível;
- fechar ticket;
- estados loading/error/empty;
- mobile/tablet/desktop.

## REALTIME
Pode usar Supabase Realtime, mas:
- canal privado;
- authorization apropriada;
- sem vazar mensagens de outros tickets;
- limpar subscription ao desmontar;
- se Realtime complicar o M13, polling seguro é aceitável no primeiro corte.

Não deixar segurança pior apenas para ter “tempo real”.

## BOUNDARIES
M13:
- cliente cria/acompanha suporte.

M32 CRAZZY SUPPORT DESK:
- fila admin;
- assignment;
- SLA/fila;
- visão operacional de staff.

Não implementar M32 inteiro dentro do M13.

M11:
- continua responsável por reveal de segredo.

M22:
- tutorial protegido.

M43:
- fulfillment.

M47:
- futuramente registra eventos de segurança/bugs críticos.

## ORDEM EXATA PARA CONTINUAR
1. Ler `docs/CHECKLIST-MASTER.md`.
2. Ler este arquivo.
3. Ler `docs/00_CONTINUE_NEXT_CHAT.md`.
4. Auditar policies atuais de `order_tickets` / `ticket_messages` apenas para evitar colisão de nomes/regras.
5. Criar migration versionada do Support.
6. Aplicar migration.
7. Criar bucket privado `support-attachments` com restrições.
8. Criar RLS de storage segura.
9. Criar API/Edge para:
   - listar tickets próprios;
   - criar ticket;
   - abrir thread;
   - enviar mensagem;
   - fechar ticket;
   - signed URL/download de anexos.
10. Construir UI.
11. Integrar contexto opcional de produto/pedido/entitlement/library sem segredo.
12. Rodar Security Advisor.
13. Criar smoke M13.
14. npm ci.
15. TypeScript.
16. production build.
17. GitHub Actions.
18. Atualizar checklist/handoff.
19. Abrir PR.
20. Merge.
21. Somente depois iniciar M14 CRAZZY COMMUNITY.

## NÃO FAZER
- não reutilizar bucket público `game-images`;
- não tornar anexos públicos;
- não expor Library secrets;
- não usar service_role no browser;
- não permitir cliente editar staff/admin fields;
- não transformar order_tickets em suporte genérico;
- não implementar M32 inteiro;
- não iniciar M14 antes do merge do M13.

## REGRA DE PERSISTÊNCIA
A cada avanço importante:
- commit no Git;
- atualizar checklist/handoff quando mudar estado relevante.

Assim qualquer outro Worker/chat consegue continuar sem depender desta conversa.


## CHECKPOINT — SCHEMA M13 APLICADO

Concluído:
- migration versionada em `supabase/migrations/202609211455_m13_support_core.sql`;
- migration adaptada para o esqueleto Support pré-existente;
- `support_tickets` e `support_messages` antigas estavam vazias;
- nenhuma linha real foi perdida;
- `support_tickets` ampliada com:
  - priority
  - product_id
  - product_plan_id
  - entitlement_id
  - order_ticket_id
  - library_delivery_id
  - assigned_to
  - last_message_at
- `support_messages` ganhou:
  - edited_at
  - sender_role user/staff/system
  - sender_id nullable com FK SET NULL
- criada `support_attachments`;
- criada `support_ticket_events`;
- authenticated agora possui somente SELECT direto nas tabelas Support;
- escrita passa pelo backend/Edge Function;
- RLS owner/admin/mod configurada;
- bucket privado `support-attachments` criado;
- bucket:
  - public=false
  - 25 MB por arquivo
  - allowlist segura de imagem/vídeo/áudio/PDF/TXT
- nenhum policy direto de browser foi concedido em storage.objects;
- uploads serão por signed upload URL;
- downloads serão por signed URL curto após authorization.

Próximo passo exato:
1. criar/versionar Edge Function `support`;
2. ações: snapshot/create/thread/message/close/reopen/upload-url/finalize-attachment;
3. depois Next API proxies;
4. depois UI /tickets.


## CHECKPOINT — M13 IMPLEMENTADO

Implementado e versionado:
- schema Support compatível com skeleton pré-existente;
- bucket privado support-attachments;
- Edge Function `support` v1 ativa;
- APIs Next:
  - /api/support
  - /api/support/[id]
  - /api/support/[id]/messages
  - /api/support/[id]/status
  - /api/support/[id]/attachments/upload-url
  - /api/support/attachments/[id]/finalize
- UI:
  - /tickets
  - /tickets/novo
  - /tickets/[id]
- contexto opcional de entitlement/order/Library;
- thread estilo chat;
- polling seguro 6s quando aba visível;
- anexos via signed upload URL;
- preview privado de imagem/vídeo/áudio;
- PDF/TXT por signed URL;
- fechar/reabrir;
- eventos de auditoria;
- App Shell Support aponta para /tickets;
- Security Advisor: 0 lints;
- performance indexes M13 aplicados;
- smoke M13 adicionado ao CI;
- regras: docs/M13-SUPPORT-RULES.md.

Próximo passo exato:
1. rodar CI do head atual;
2. corrigir qualquer erro TypeScript/build/smoke;
3. atualizar checklist;
4. PR M13;
5. squash merge;
6. validar phase-1-home pós-merge;
7. iniciar M14 CRAZZY COMMUNITY.


## CHECKPOINT — QA M13 VERDE

CI oficial da branch `m13-support`:
- npm ci: PASS
- TypeScript: PASS
- production build: PASS
- M13 Support security smoke: PASS
- GitHub Actions run: 35617153952
- Supabase Security Advisor: 0 lints

Smoke comprovou:
- anon bloqueado de support_tickets;
- anon bloqueado de support_messages;
- anon bloqueado de support_attachments;
- anon bloqueado de support_ticket_events;
- Support snapshot exige autenticação;
- criação de ticket exige autenticação;
- bucket Support sem acesso público;
- catálogo público continua acessível.

Falta:
1. PR M13;
2. squash merge;
3. validar phase-1-home pós-merge;
4. iniciar M14 CRAZZY COMMUNITY.
