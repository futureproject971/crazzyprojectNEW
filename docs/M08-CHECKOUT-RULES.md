# M08 — CRAZZY CHECKOUT

Status: **implementado estruturalmente; ativação real do gateway permanece desligada até configuração de secrets e M09 Auth.**

## Métodos

- PIX
- Cartão
- Litecoin (LTC)

PurinCash continua sendo o gateway oficial do CRAZZY PROJECT.

## Fonte da verdade

O navegador nunca define:
- preço;
- desconto;
- valor final;
- status de pagamento;
- entrega.

O backend recalcula tudo com:
- produto/plano ativo no banco;
- preço do banco;
- combo elegível pelo `plan_code`;
- cupom válido;
- regras de reseller quando aplicáveis;
- conta LZT somente quando o feature gate estiver habilitado.

## Combo + cupom

Somente um benefício é aplicado:
- Combo Mensal/Lifetime calculado no servidor;
- Cupom calculado no servidor;
- vence o maior desconto válido;
- os dois nunca acumulam.

Faixas do combo:
- 2 produtos diferentes = 10%
- 3 = 15%
- 4 = 20%
- 5 = 25%
- 6 = 30%
- 7+ = 35% teto

Mensal (`30d`) e Lifetime são grupos separados.

## Idempotência de criação

Toda tentativa M08 envia `idempotency_key`.

Antes de chamar a PurinCash:
1. o servidor calcula o pedido;
2. reserva uma linha `payments` com status `CREATING`;
3. existe índice único `(user_id, idempotency_key)`;
4. a mesma tentativa não pode disparar duas cobranças;
5. se a cobrança já foi criada, o payload seguro salvo é reutilizado.

Isto protege contra:
- duplo clique;
- retry do browser;
- timeout do cliente;
- reenvio acidental da mesma tentativa.

## Integridade pós-criação

O cart snapshot persistido recebe HMAC server-side que liga:
- payment id interno;
- charge/order id do provider;
- user id;
- total em centavos;
- cupom aplicado;
- desconto;
- cart snapshot.

Antes do fulfillment a prova é verificada novamente.

## Webhook

Endpoint:
`/functions/v1/purincash-payment?action=webhook`

Regras:
- corpo cru;
- HMAC SHA-256;
- header `X-Webhook-Signature`;
- `X-Webhook-Id` disponível pelo provider;
- evento reconciliado por GET no provider antes de entregar;
- valor pago deve ser idêntico ao valor interno;
- status precisa estar pago;
- pagamento é atomicamente marcado `FULFILLING`;
- apenas um worker consegue iniciar a entrega;
- unidades de estoque usam claim idempotente.

Eventos aceitos:
- `charge.paid`
- `payment.paid`
- `card_payment.paid`

Cartão normaliza:
- `orderCode`;
- `amount` decimal BRL usando Math.round(*100).

PIX/LTC normalizam:
- `paymentId`;
- `amountCents`.

## Polling

Frontend consulta status como fallback/reconcile:
- PIX -> charge status;
- cartão -> card payment status;
- LTC -> payment status.

Nunca liberar produto pela `successUrl` do cartão.

## Litecoin

- mostrar `ltc.amount` exatamente como recebido;
- não arredondar;
- endereço exibido integralmente;
- polling/webhook só conclui após confirmação do provider.

## LZT

M08 removeu o câmbio RUB -> BRL fixo legado.

Quando LZT for ativado:
- detalhe deve ser solicitado em BRL;
- se o provider não devolver BRL, checkout falha fechado;
- markup continua server-side;
- `ENABLE_LZT_AUTO_BUY` continua desligado até a ativação futura.

## RLS

Tabela `payments`:
- comprador autenticado: SELECT somente do próprio pagamento;
- comprador não pode INSERT/UPDATE/DELETE;
- escrita comercial fica em service role/admin.

## Banco M08

Adicionado em `product_plans`:
- `plan_code`;
- `show_when_out_of_stock`.

Adicionado em `payments`:
- `idempotency_key`;
- `payment_method`;
- `expires_at`;
- `checkout_payload`.

Índices:
- unique `product_id + plan_code`;
- unique `user_id + idempotency_key`.

## Rotas Frontend

- `/checkout`
- `/api/checkout/config`
- `/api/checkout/quote`
- `/api/checkout/create`
- `/api/checkout/status`

## Gate de autenticação

M08 exige sessão real.

Enquanto M09 não estiver integrado:
- checkout mostra gate de login;
- quote/create não aceitam visitante;
- nenhuma exceção de guest checkout é criada.

Contrato para M09:
- header `Authorization: Bearer <token>`, ou
- cookie server-side `crazzy_access_token`.

## Ativação futura

Secrets:
- `PURINCASH_API_KEY`
- `PURINCASH_WEBHOOK_SECRET`
- `CHECKOUT_SIGNING_SECRET`
- `PUBLIC_SITE_URL`

Cartão:
- `ENABLE_CARD_CHECKOUT=true`

Banco:
- habilitar `payment_settings.pix`
- habilitar `payment_settings.card`
- habilitar `payment_settings.crypto`

Só habilitar depois dos testes de sandbox/produção aplicáveis.
