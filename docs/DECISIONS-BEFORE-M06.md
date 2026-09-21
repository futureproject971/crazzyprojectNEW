# CRAZZY PROJECT — DECISIONS BEFORE M06

Estas decisões devem ser respondidas antes de implementar backend/fulfillment definitivo.

## D01 — Fonte de keys

### Opções
A. Estoque interno Supabase / M27.
B. PurinCash supplier.
C. Híbrido.

### Recomendação
**C — Híbrido**, com `internal_stock` como padrão.

Motivo:
- mantém admin/estoque sob controle do site;
- permite usar supplier PurinCash quando já existe estoque útil lá;
- suporta LZT e serviços no mesmo Fulfillment Engine.

---

## D02 — Cargo Discord por produto

### Recomendação
Uma role por produto/benefício, não uma role por cliente.

Campos:
- role id;
- nome;
- emoji;
- cor;
- prioridade;
- revoke on expire;
- revoke on refund.

Formato de nome precisa de definição do usuário.

---

## D03 — Expiração

Perguntas:
- plano Diário/Semanal/Mensal remove cargo Discord quando expira?
- tutorial protegido também expira?
- key continua visível no histórico após expiração?

### Recomendação
- cargo: remover ao expirar;
- entitlement ativo: expirar;
- biblioteca/histórico: manter;
- key já entregue: continuar acessível ao dono, salvo revogação específica;
- tutorial: decisão de negócio ainda pendente.

---

## D04 — Discord Bot

Pergunta:
usar o bot CRAZZY existente ou criar serviço/bot separado?

### Recomendação
Se o bot atual já é estável e pertence ao mesmo servidor:
reaproveitar a mesma aplicação Discord e adicionar um serviço de sync isolado.

Não misturar lógica de ticket, fulfillment e roles no mesmo arquivo/processo.

---

## D05 — PurinCash

### Recomendação
PurinCash é gateway.
CRAZZY PROJECT continua fonte de pedido/produto/entitlement.

Usar:
- PIX;
- cartão;
- LTC;
- webhook;
- polling;
- disputes;
- supplier opcional.

Não depender do catálogo da loja PurinCash como banco principal do site.

---

## D06 — Tutorial

Pink possui base útil:
- tutorial_text;
- tutorial_file_url;
- upload de imagem/vídeo;
- product_media;
- sort_order;
- entrega no pedido.

### Recomendação
Migrar conceitos/upload/storage.
Criar novo editor por blocos no M45.

Perguntas:
- acesso por produto ou por plano?
- tutorial permanece após expiração?
- vídeo será upload direto, YouTube/stream embed, ou ambos?

---

## D07 — MT Sounds

Definido:
- recurso free;
- última aba pública;
- vive dentro da CRAZZY PROJECT.

Pendente:
source/repo do site.

### Recomendação
Portar source para Next.js.
Iframe apenas fallback temporário.

---

## D08 — Refund / dispute

Pergunta:
ao reembolsar/estornar, o sistema deve:
- revogar cargo;
- revogar tutorial;
- bloquear key/download futuro;
- manter histórico?

### Recomendação
- manter histórico;
- revogar entitlement ativo;
- remover cargo;
- bloquear novos downloads protegidos;
- nunca apagar logs/evidências.

---

## D09 — Role color no chat

Definido:
experiência estilo Discord.

### Recomendação
Cor do nick = role visível de maior prioridade.

Cargos manuais podem aparecer no perfil, mas só roles/entitlements mapeados liberam conteúdo pago.
