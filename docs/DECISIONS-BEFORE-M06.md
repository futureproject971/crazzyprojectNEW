# CRAZZY PROJECT — DECISIONS BEFORE M06

Status: **D01-D10 APROVADAS pelo usuário em 2026-09-21.**

Estas decisões passam a ser regra oficial da arquitetura até nova decisão explícita do usuário.

## D01 — Fonte de keys ✅ FECHADA

**Decisão: HÍBRIDO.**

- `internal_stock` / Supabase / M27 é o padrão para produtos próprios.
- `purincash_supplier` pode ser usado por produto/plano quando fizer sentido.
- M06/LZT usa `lzt_account`.
- Serviços podem usar `manual` ou `service`.
- O M43 CRAZZY FULFILLMENT ENGINE é o único dono da entrega pós-pagamento.

---

## D02 — Cargo Discord por produto ✅ FECHADA

- Uma role por produto/benefício, nunca uma role nova por cliente.
- Formato padrão de nome: **`emoji | PRODUTO`**.
- Configuração pode guardar role id, emoji, cor, prioridade, `revoke_on_expire` e `revoke_on_refund`.
- Cargo Discord não é prova de compra. Entitlement do site continua sendo a fonte de verdade.

---

## D03 — Expiração ✅ FECHADA

Quando plano Diário/Semanal/Mensal expirar:

- entitlement ativo expira;
- cargo Discord correspondente é removido;
- biblioteca/histórico permanece;
- key já entregue continua acessível ao dono no histórico, salvo revogação específica;
- tutorial já liberado permanece acessível após a expiração normal do plano;
- refund/dispute segue D08 e pode revogar acesso protegido.

---

## D04 — Discord Bot ✅ FECHADA

- Reaproveitar a aplicação/bot CRAZZY existente se o código estiver saudável.
- O serviço de sincronização será isolado no M44 CRAZZY DISCORD BRIDGE.
- Não misturar ticket, fulfillment, roles e sync em um único arquivo/processo.
- Falha do Discord nunca pode derrubar auth, checkout ou fulfillment.

---

## D05 — PurinCash ✅ FECHADA

- PurinCash é gateway de pagamento.
- CRAZZY PROJECT continua fonte de produtos, pedidos e entitlements.
- Métodos previstos: PIX, cartão e LTC.
- Webhook, idempotência, value check e reconcile/polling são obrigatórios.
- Supplier PurinCash é opcional por produto/plano.
- O catálogo da PurinCash não é o banco principal do site.

---

## D06 — Tutorial ✅ FECHADA

- Acesso pode ser associado a produto **e/ou plano** por regra.
- O entitlement libera o tutorial.
- Após expiração normal do plano, o tutorial permanece acessível.
- Refund/dispute pode revogar o acesso protegido conforme D08.
- Vídeos aceitam **upload direto e YouTube/link/embed**.
- Reaproveitar conceitos úteis de mídia/upload/sort_order do Pink.
- O editor por blocos será o M45 CRAZZY TUTORIAL STUDIO.

---

## D07 — MT Sounds ✅ DECISÃO FECHADA / SOURCE AINDA PENDENTE

- MT Sounds será recurso free/parceiro.
- Será a última aba pública.
- Rota planejada: `/mtsounds`.
- Deve viver dentro do CRAZZY PROJECT e do mesmo App Shell.
- Estratégia oficial: portar o source para Next.js.
- Iframe é apenas fallback temporário.
- O source/repo ainda precisa ser recebido/localizado, mas isso é uma dependência de implementação do M46, não uma decisão de arquitetura pendente e não bloqueia o início do M06.

---

## D08 — Refund / dispute ✅ FECHADA

Em refund/chargeback/dispute confirmado:

- manter histórico e evidências;
- revogar entitlement ativo;
- remover cargo Discord relacionado;
- bloquear novos downloads/entregas protegidas;
- revogar acesso protegido quando aplicável;
- não apagar logs/evidências;
- registrar evento sensível no M47 Security Sentinel.

---

## D09 — Role color no chat ✅ FECHADA

- Cor do nick = role visível de maior prioridade.
- Cargos manuais podem aparecer no perfil.
- Apenas roles/entitlements mapeados liberam conteúdo pago.

---

## D10 — Security Sentinel ✅ FECHADA

- Canal padrão: **`#security-logs`**, privado e configurável.
- INFO/WARN: sem ping.
- HIGH: normalmente sem ping; agregação/repetição pode elevar tratamento.
- CRITICAL: pode mencionar somente uma role administrativa/de segurança configurada.
- Cooldown, agregação e deduplicação são obrigatórios.
- Nunca enviar secrets, tokens, senhas, keys, licenças ou conteúdo entregue ao Discord.
- Discord offline não bloqueia o fluxo principal.

---

# GATE DO M06

Com D01-D10 aprovadas, o gate de decisões está **FECHADO**.

Sequência aprovada:
1. mergear PR #6 — M05;
2. mergear PR #7 — Architecture V2;
3. criar branch `m06-accounts-market`;
4. migrar FortuneECrazzy/LZT para CRAZZY PROJECT;
5. não recriar LZT do zero;
6. manter PurinCash, Discord, Fulfillment, Tutorial Studio, MT Sounds e Security Sentinel como arquitetura obrigatória.
