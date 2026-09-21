# CRAZZY PROJECT — PAYMENT, FULFILLMENT, DISCORD & TUTORIAL ARCHITECTURE

## Objetivo

Definir como compra, pagamento, key, acesso, cargo Discord e tutorial se conectam sem duplicar lógica.

---

## 1. PurinCash

Gateway oficial planejado.

### Métodos
- PIX
- Cartão
- Litecoin (LTC)

### Endpoints relevantes
- PIX/LTC: `POST /v1/payments`
- PIX avulso: `POST /v1/charges`
- Cartão: `POST /v1/card-payments`
- consulta PIX/LTC: `GET /v1/payments/{paymentId}`
- consulta PIX charge: `GET /v1/charges/{paymentId}`
- consulta cartão: `GET /v1/card-payments/{orderCode}`
- entrega PurinCash: `GET /v1/deliveries/{paymentId}`

### Regras obrigatórias
- API key somente server-side.
- Webhook secret somente server-side.
- HMAC-SHA256 sobre corpo cru.
- deduplicar por `X-Webhook-Id`.
- valor do pedido sempre recalculado no servidor.
- confirmar valor recebido antes de fulfillment.
- `successUrl` nunca confirma compra.
- polling/reconcile é fallback, não substituto do webhook.
- guardar paymentId/orderCode e tentativas.

### LTC
- manter todas as casas decimais recebidas;
- nunca arredondar o valor de LTC;
- fluxo assíncrono;
- status de UI: aguardando rede;
- não existe sandbox LTC.

### Cartão
- checkout hospedado;
- cartão nunca passa pelo nosso site;
- confirmação por webhook/consulta;
- sandbox não cobre cartão.

---

## 2. Estratégia de entrega

Cada plano possui `delivery_mode`.

### internal_stock
Key/licença vem do M27 CRAZZY STOCK.

Recomendado como padrão para produtos próprios.

### purincash_supplier
Plano é mapeado para:
- supplier public product id;
- variation index.

PurinCash entrega conteúdo e o M43 registra/replica de forma segura.

Útil quando o estoque já vive na loja PurinCash/Discord.

### lzt_account
Entrega vem do M06/LZT.

### manual
Pedido é pago, mas entra em fila humana.

### service
Cria entitlement/ordem de serviço, sem key.

---

## 3. Fulfillment pós-pagamento

Único dono: M43 CRAZZY FULFILLMENT ENGINE.

Estado sugerido:

`pending_payment -> paid -> fulfilling -> delivered`

Estados de exceção:
- payment_mismatch
- stock_empty
- supplier_error
- discord_pending
- partial
- manual_required
- refunded
- revoked

### Operação
A mesma compra pode disparar vários grants:

- delivery grant;
- entitlement grant;
- tutorial grant;
- Discord role grant;
- notification grant.

Cada grant possui chave idempotente.

Exemplo conceitual:
`order_id + grant_type + target_id`

Reprocessar não pode duplicar key nem cargo.

---

## 4. Entitlements

Tabela lógica central sugerida:

`entitlements`

Campos principais:
- id
- user_id
- order_id
- product_id
- plan_id
- source
- status
- starts_at
- expires_at
- revoked_at
- metadata

O site NÃO deve considerar um cargo Discord como prova suficiente de compra.

Entitlement é a fonte de verdade.

---

## 5. Keys e entregas

Estruturas sugeridas:

### stock_items
- id
- product_id
- plan_id
- encrypted_content
- status
- reserved_by
- delivered_to
- delivered_at
- created_at

### deliveries
- id
- order_id
- entitlement_id
- type
- provider
- sensitive_content_ref
- status
- delivered_at
- last_error
- retry_count

Conteúdo sensível:
- não expor em endpoint público;
- não imprimir em log;
- preferir criptografia/controle de acesso;
- apenas dono/admin autorizado pode revelar.

---

## 6. Discord

### Vinculação
M09 vincula:
- site user id
- discord user id
- guild member status

### Role config
Produto/plano pode apontar para:
- discord_role_id
- desired_role_name
- emoji
- color
- position/priority metadata
- revoke_on_expire
- revoke_on_refund

### Regra recomendada
Não criar uma role por cliente.
Criar uma role por produto/benefício e atribuir aos clientes.

### Chat
M14 recebe role snapshot do M44 e exibe:
- nick na cor da role principal;
- lista de cargos;
- avatar;
- badge;
- perfil popover.

O cargo principal é a role de maior prioridade entre as roles visíveis/mapeadas.

### Autoridade
- entitlement de compra: site é autoridade;
- metadata/cor/posição da role: Discord é autoridade visual;
- role administrativa manual não libera tutorial pago automaticamente.

---

## 7. Tutorial protegido

M22 renderiza tutoriais.
M45 cria/edita.

### Modelo

`tutorials`
- id
- slug
- title
- status
- access_mode
- version

`tutorial_sections`
- id
- tutorial_id
- title
- sort_order

`tutorial_blocks`
- id
- section_id
- type
- sort_order
- data jsonb

`tutorial_access_rules`
- tutorial_id
- product_id nullable
- plan_id nullable
- entitlement_required
- active_required

### Block types
- heading
- paragraph
- image
- video
- gallery
- checklist
- keybind
- code
- download
- button
- info
- warning
- important
- success
- divider

### Viewer
Cliente só recebe conteúdo protegido se o servidor validar entitlement.

Não basta esconder link no frontend.

---

## 8. Evidência de entrega

Como produtos são digitais, registrar no momento da compra:
- payment id;
- paid_at;
- user id;
- produto/plano;
- key entregue ou hash/ref;
- primeira revelação;
- Discord role grant;
- tutorial grant;
- download;
- IP/session quando permitido e necessário;
- aceite de termos.

Esses eventos podem ajudar suporte e contestação sem depender de print manual.

---

## 9. Migração do IFOOD 420

Migrar padrões, não domínio de negócio.

Aproveitar:
- recomputar preço server-side;
- validar dono do pedido;
- cobrança viva/reuso;
- histórico de cobranças;
- webhook HMAC;
- idempotência;
- value check;
- polling de fallback;
- secrets server-side.

Não aproveitar:
- motoboy;
- taxa de entrega;
- rotas;
- fiado;
- regras de restaurante/delivery.

---

## 10. MT Sounds

Rota pública planejada:
`/mtsounds`

Objetivo:
recurso gratuito para comunidade MTA vivendo dentro da CRAZZY PROJECT.

### Opção preferida
Portar source para:
`src/modules/mt-sounds`

Benefícios:
- mesma Navbar/AppShell;
- mesma conta se necessário no futuro;
- PWA única;
- URL única;
- analytics únicos;
- sem barra dupla;
- melhor mobile.

### Fallback temporário
Iframe/bridge, somente até o source ser conectado.

Não redesenhar a ferramenta ao migrar.
A CRAZZY PROJECT deve emoldurar, não destruir a experiência conhecida.

---

## 11. Rollback e retries

Toda integração externa deve suportar:
- retry;
- timeout;
- log de erro;
- replay seguro;
- idempotência;
- reconcile job.

Nunca considerar um POST externo como infalível.


---

## 12. Security Sentinel

M47 centraliza auditoria, detecção de abuso e alertas.

### Eventos mínimos
- auth_failed
- auth_rate_limited
- admin_forbidden
- stock_forbidden
- stock_probe
- privilege_escalation_attempt
- price_tamper_attempt
- webhook_signature_invalid
- webhook_replay_detected
- fulfillment_failure
- stock_reservation_conflict
- discord_sync_failure
- lzt_provider_error
- payment_value_mismatch
- suspicious_request_pattern
- application_5xx
- critical_bug

### Estrutura sugerida

`security_events`
- id
- event_type
- severity
- user_id nullable
- discord_user_id nullable
- request_id
- route
- method
- ip_hash_or_masked
- user_agent_summary
- metadata jsonb
- created_at
- acknowledged_at nullable
- acknowledged_by nullable
- resolved_at nullable

### Pipeline
1. detectar evento;
2. registrar evento estruturado;
3. mascarar/remover dados sensíveis;
4. deduplicar/agrupar;
5. calcular severidade;
6. disparar alerta Discord quando necessário;
7. manter evento no painel;
8. permitir acknowledge/resolution.

### Segurança do próprio log
- sem API keys;
- sem tokens;
- sem senhas;
- sem keys/licenças;
- sem conteúdo entregue em texto aberto;
- acesso admin restrito.

### Discord
O M47 usa o M44 para entregar alertas.
Discord recebe somente resumo seguro.
Falha do Discord não bloqueia o fluxo principal.

### Anti-spam
Eventos repetidos devem ser agregados por janela de tempo para não inundar o canal.
