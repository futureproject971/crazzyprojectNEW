# CRAZZY PROJECT — MASTER ROADMAP V2

Atualizado em 2026-09-21 após auditoria dos projetos antigos, PurinCash, Discord, tutoriais, entrega digital e MT Sounds.

## Regra central

### Regra permanente — Discord
A CRAZZY PROJECT terá **um único bot Discord oficial**.

Arquitetura obrigatória:
- um único token Discord;
- um único processo/worker 24/7 na Discloud;
- arquitetura modular interna;
- Supabase como fila/estado compartilhado com o site;
- site como painel de controle;
- nunca criar outro bot separado para campanha, cargo, notificação, ticket ou alerta;
- novos recursos Discord entram como módulo do mesmo bot-core.

Módulos previstos no bot-core:
1. Campaigns/DM;
2. Discord Bridge de cargos;
3. Notify;
4. Tickets/Support;
5. Security Sentinel alerts;
6. Slash commands administrativos;
7. integrações futuras.

A CRAZZY PROJECT continua sendo a fonte de verdade para:
- arquitetura;
- identidade visual;
- Design System;
- App Shell;
- experiência pública;
- experiência do cliente;
- experiência administrativa.

Projetos antigos são fontes de funcionalidades comprovadas, não templates visuais.

Quando uma função útil já existir e estiver madura:
1. estudar;
2. auditar;
3. corrigir problemas conhecidos;
4. migrar somente a função;
5. adaptar ao padrão CRAZZY PROJECT.

Não copiar projeto antigo inteiro.

---

## Fontes aprovadas para migração

### CRAZZY PROJECT atual
Fonte principal de visual, navegação e arquitetura modular.

### FortuneECrazzy
Fonte preferencial para:
- M06 Accounts Market;
- integração LZT;
- filtros/detalhes específicos por jogo;
- markup LZT.

### Pink
Fonte preferencial para:
- experiência da Raspadinha;
- admin da Raspadinha;
- ideias de estoque, cupons, revendedores e financeiro.

A lógica aleatória da raspadinha NÃO será copiada como está. Sorteio deverá ser server-side.

### IFOOD 420
Fonte de estudo/migração para padrões robustos de PurinCash:
- preço recalculado no servidor;
- segredo fora do frontend;
- propriedade do pedido;
- reaproveitamento de cobrança viva;
- histórico de tentativas/cobranças;
- webhook HMAC;
- idempotência;
- validação de valor;
- polling/reconciliação como fallback.

Não importar regras específicas de delivery/motoboy.

### MT Sounds
O site existente será incorporado como recurso gratuito/parceiro dentro da CRAZZY PROJECT.
A aba pública aparecerá por último na navegação.

Preferência:
- migrar o código-fonte para dentro do Next.js;
- iframe somente como ponte temporária caso o source ainda não esteja disponível.

---

# ORDEM DOS MÓDULOS

## GRUPO 00 — CORE

### M00 — CRAZZY DESIGN SYSTEM
Status: APROVADO / INTEGRADO.

### M01 — CRAZZY APP SHELL
Status: APROVADO / INTEGRADO.

---

## GRUPO 01 — EXPERIÊNCIA PÚBLICA

### M02 — CRAZZY HOME
Status: APROVADO / INTEGRADO.

### M03 — CRAZZY DISCOVERY
Status: APROVADO / INTEGRADO.

---

## GRUPO 02 — COMÉRCIO

### M04 — CRAZZY CATALOG
Status: APROVADO / INTEGRADO.

### M05 — CRAZZY PRODUCT VIEW
Status: CONCLUÍDO TECNICAMENTE / PR ABERTO / AGUARDANDO APROVAÇÃO.

Inclui:
- galeria;
- planos;
- avaliações;
- compatibilidade;
- CTA;
- produtos relacionados.

Continua sem preço inventado e sem compra real.

### M06 — CRAZZY ACCOUNTS MARKET
Fonte: FortuneECrazzy + LZT.

Não criar do zero.

Migrar/adaptar:
- listagem de contas;
- detalhes;
- Valorant;
- LoL;
- Fortnite;
- Minecraft;
- rank;
- skins;
- inventário;
- level;
- região;
- filtros;
- markup;
- compra/entrega LZT quando backend estiver autorizado.

Visual será totalmente CRAZZY PROJECT.

### M07 — CRAZZY CART
Inclui:
- produto/conta;
- plano;
- quantidade quando aplicável;
- cupom;
- subtotal;
- desconto;
- total;
- carrinho rápido;
- página completa.

O carrinho não decide preço final. O servidor recalcula no checkout.

### M08 — CRAZZY CHECKOUT
Gateway oficial planejado: PurinCash.

Métodos:
- PIX;
- cartão;
- LTC.

Frontend:
- resumo;
- cliente;
- cupom;
- método;
- PIX QR/copia e cola;
- cartão hospedado;
- LTC endereço + valor exato;
- status;
- expiração;
- confirmação.

Backend futuro:
- nunca aceitar preço do navegador como fonte da verdade;
- webhook assinado;
- idempotência;
- validação de valor;
- reconciliação/polling;
- nenhuma entrega baseada somente em successUrl.

---

## GRUPO 03 — IDENTIDADE, CLIENTE E DIREITOS

### M09 — CRAZZY AUTH
Além do escopo original:
- Discord OAuth/link obrigatório para recursos Discord;
- Discord user id;
- vínculo de guild;
- estado de sincronização;
- Google opcional;
- sessão segura.

A autenticação do site não dependerá exclusivamente do cargo Discord.

### M10 — CRAZZY CLIENT HUB
Adicionar:
- produtos ativos;
- direitos/entitlements;
- cargos sincronizados;
- atalhos para tutoriais liberados;
- entregas recentes;
- estado Discord sync.

### M11 — CRAZZY LIBRARY
Adicionar:
- entrega automática;
- key/licença/conta/link entregue;
- revelar/copiar conteúdo;
- histórico de entrega;
- tutorial correspondente ao produto;
- estado do cargo Discord;
- reconsulta segura de entrega;
- acesso de suporte.

Conteúdo entregue é sensível e exige usuário autenticado.

### M12 — CRAZZY PROFILE
Adicionar:
- Discord conectado;
- cargos Discord;
- cargos CRAZZY;
- cor do cargo principal;
- badges;
- sincronização;
- preferências de exibição.

Regra visual:
a cor pública do usuário segue o cargo de maior prioridade, no estilo Discord.

---

## GRUPO 04 — SUPORTE E COMUNIDADE

### M13 — CRAZZY SUPPORT
Preservar ticket multimídia.
Adicionar contexto automático:
- produto;
- compra;
- entitlement;
- key entregue;
- status Discord;
- tutorial relacionado.

### M14 — CRAZZY COMMUNITY
Adicionar experiência Discord-like:
- cor do nick pelo cargo principal;
- perfil ao clicar no usuário;
- avatar;
- bio curta;
- cargos;
- badges;
- produtos/cargos permitidos para exibição;
- status;
- reações;
- respostas.

Importante:
o chat apenas exibe os cargos.
A sincronização pertence ao M44 Discord Bridge.

### M15 — CRAZZY REVIEWS
Compra verificada deverá vir de entitlement/pedido real.

---

## GRUPO 05 — CRAZZY CLUB

### M16 — CRAZZY CLUB HUB
Sem mudança estrutural.

### M17 — CRAZZY REWARDS
Sem mudança estrutural.

### M18 — CRAZZY LUCK
Fonte visual/funcional: Pink.

Inclui:
- Roleta;
- Raspadinha;
- Drops;
- prêmios.

Correções obrigatórias na migração:
- RNG/sorteio server-side;
- porcentagens reais e auditáveis;
- resultado impossível de alterar no navegador;
- idempotência;
- log da jogada;
- pagamento confirmado antes da jogada paga;
- produto/conta/cupom/reward como prêmio.

### M19 — CRAZZY COUPONS
Integrado ao Cart/Checkout.

### M20 — CRAZZY RANK
Pode usar cargos/badges no perfil e chat.

---

## GRUPO 06 — INFORMAÇÃO, TUTORIAIS E PARCEIROS

### M21 — CRAZZY STATUS
Sem mudança estrutural.

### M22 — CRAZZY ACADEMY
Atualização importante.

Dois tipos de tutorial:
1. público/global;
2. tutorial protegido por produto/entitlement.

O cliente verá somente tutoriais aos quais possui direito.

Suportar renderer em blocos:
- título;
- subtítulo;
- texto;
- imagem;
- vídeo;
- galeria;
- checklist;
- atalhos/teclas;
- código;
- arquivo;
- botão/link;
- caixa azul INFO;
- caixa vermelha ATENÇÃO;
- caixa amarela IMPORTANTE;
- caixa verde SUCESSO;
- separador;
- passo numerado.

Ordem dos blocos é editável.

### M23 — CRAZZY HELP
Busca em FAQ e tutorial público.

### M23.1 — MT SOUNDS PARTNER
Nova aba pública, sempre a última da navegação.

Rota planejada:
`/mtsounds`

Regras:
- recurso gratuito;
- marca de parceiro preservada;
- vive dentro do App Shell da CRAZZY PROJECT;
- sem abrir outro site como experiência principal;
- não exige compra;
- integração visual sem descaracterizar a ferramenta.

Preferência técnica:
migrar source para um módulo isolado.
Fallback temporário: embed controlado.

---

## GRUPO 07 — ADMIN COMERCIAL

### M24 — CRAZZY CONTROL CENTER
Adicionar alertas:
- pagamentos divergentes;
- fulfillment com falha;
- Discord sync com falha;
- estoque baixo;
- tutorial faltando;
- disputa PurinCash.

### M25 — CRAZZY PRODUCT MANAGER
Expandido.

Além do escopo original, cada produto/plano poderá configurar:
- emoji;
- cor;
- tutorial associado;
- modo de entrega;
- cargo Discord;
- cor do cargo;
- prioridade do cargo;
- duração/expiração do entitlement;
- supplier PurinCash opcional;
- produto/variação externa opcional;
- flags de automação.

Modos de entrega planejados:
- internal_stock;
- purincash_supplier;
- lzt_account;
- manual;
- service.

### M26 — CRAZZY CATEGORY MANAGER
Sem mudança estrutural.

### M27 — CRAZZY STOCK
Fonte principal recomendada para keys próprias.

Adicionar:
- reserva atômica;
- consumo idempotente;
- vínculo com pedido;
- nunca reutilizar key entregue;
- trilha de auditoria;
- importação em lote;
- opcional: estoque externo PurinCash supplier.

### M28 — CRAZZY SALES
Adicionar:
- payment status;
- fulfillment status;
- entitlement status;
- Discord role status;
- tutorial unlock status;
- delivery log.

### M29 — CRAZZY PAYMENTS
Status: IMPLEMENTADO / QA FINAL.

Gateway principal: PurinCash.

Admin:
- PIX;
- cartão;
- LTC;
- transações;
- paymentId/orderCode mascarado;
- status;
- tentativas/idempotência;
- webhooks/eventos operacionais;
- divergências;
- reconciliação manual real contra o gateway;
- casos de reembolso;
- disputas;
- evidências.

Implementado:
- rota `/admin/pagamentos`;
- filtros por status/método/cliente/payment/charge/idempotency;
- liga/desliga de métodos via `payment_settings`;
- `payment_events`;
- `payment_reconcile_requests`;
- `payment_refunds`;
- `payment_disputes`;
- `payment_dispute_evidence`;
- RPCs admin-only com SECURITY INVOKER;
- Edge Function `purincash-payment?action=admin-reconcile`;
- verificação de admin no Edge;
- comparação de valor gateway x pedido;
- reaproveitamento do fulfillment idempotente existente;
- divergência crítica não força transição insegura;
- nenhum payload bruto/QR/proof/segredo no painel;
- registro de refund não movimenta dinheiro automaticamente até endpoint oficial ser validado.

Capacidades PurinCash úteis reservadas:
- sandbox para PIX;
- webhooks HMAC-SHA256;
- polling GET;
- LTC;
- cartão hospedado;
- automatic delivery/supplier opcional;
- refund provider real somente após validação oficial do endpoint;
- subscriptions opcionais;
- split/subcontas opcionais para revendedores.

### M30 — CRAZZY FINANCE
Adicionar:
- taxas de gateway;
- receita por método;
- reembolso;
- disputa;
- retenção;
- resultado líquido.

---

## GRUPO 08 — ADMIN CLIENTE E SUPORTE

### M31 — CRAZZY CUSTOMER 360
Adicionar:
- Discord ID;
- cargos;
- entitlement;
- keys/deliveries;
- tutoriais liberados;
- sync status;
- histórico de fulfillment.

### M32 — CRAZZY SUPPORT DESK
Adicionar contexto de entitlement/delivery.

### M33 — CRAZZY COMMUNITY MOD
Adicionar:
- cargos exibidos;
- cor do usuário;
- sincronização manual;
- auditoria de role display.

Não usar moderação para conceder produto pago.

### M34 — CRAZZY RESELLERS
Reservar:
- split/subconta PurinCash opcional;
- comissão;
- produtos permitidos;
- expiração;
- auditoria.

---

## GRUPO 09 — ADMIN ENGAJAMENTO

### M35 — CRAZZY CLUB MANAGER
Sem mudança estrutural.

### M36 — CRAZZY REWARD MANAGER
Entrega deve usar o M43 Fulfillment Engine.

### M37 — CRAZZY LUCK MANAGER
Migrar ideias do admin Pink.

Inclui:
- preço da jogada;
- chances;
- pesos;
- prêmios;
- produto/conta/cupom/reward;
- período;
- limites;
- receita;
- logs.

Sorteio sempre no servidor.

### M38 — CRAZZY COUPON MANAGER
Sem mudança estrutural.

---

## GRUPO 10 — ADMIN / SISTEMA

### M39 — CRAZZY APPEARANCE
Sem mudança estrutural.

### M40 — CRAZZY SETTINGS & INTEGRATIONS
Expandido.

Abas planejadas:
- Loja;
- PurinCash;
- Discord Bot;
- LZT;
- MT Sounds;
- segurança;
- feature flags.

Segredos nunca ficam expostos no frontend.

### M41 — CRAZZY NOTIFY
Adicionar:
- Discord DM;
- cargo entregue;
- key entregue;
- tutorial liberado;
- compra aprovada;
- pagamento pendente;
- falha que exige suporte.

### M42 — CRAZZY PWA
Sem mudança estrutural.

---

# NOVOS MÓDULOS DE SISTEMA

### M43 — CRAZZY FULFILLMENT ENGINE
Proprietário da entrega pós-pagamento.

Fluxo idempotente:
1. pagamento confirmado;
2. confirmar valor/pedido;
3. criar entitlement;
4. entregar key/conta/link/serviço;
5. liberar tutorial;
6. solicitar cargo Discord;
7. registrar evidência;
8. notificar cliente;
9. concluir fulfillment.

Não duplicar essa lógica em Checkout, Library, Stock ou Discord Bot.

### M44 — CRAZZY DISCORD BRIDGE
Proprietário da sincronização site ↔ Discord.

Regra fixa de infraestrutura:
- existe apenas UM Bot Core CRAZZY PROJECT;
- um Discord application/client;
- um token;
- uma conexão Gateway;
- um processo Discloud;
- Campanhas/DM e Server Builder já são módulos internos desse mesmo processo;
- Bridge, Notify, Support e Security Alerts entram como módulos adicionais, nunca como bots separados.

Server Builder já incorporado ao Bot Core:
- /preview-tema;
- /montar-servidor;
- editor visual em /admin/discord;
- template/tema centralizados no Supabase;
- fila e histórico;
- SAFE MODE append-only;
- sem delete/rename/move/reposition/perms em recursos existentes.

Inclui:
- bot;
- guild;
- usuários vinculados;
- leitura de cargos;
- mapeamento product → role;
- grant/revoke;
- retry;
- reconcile;
- cor/prioridade;
- cache de role metadata;
- status de sync.

Regra de segurança:
cargo Discord manual não concede automaticamente produto pago.
Entitlement do site continua sendo a fonte de direito de acesso.

### M45 — CRAZZY TUTORIAL STUDIO
Admin editor de tutoriais.

Fonte parcial:
Pink já possui tutorial por produto, texto, arquivo, upload de mídia e `sort_order`.
Essas peças podem ser estudadas/migradas, mas o editor em blocos será uma evolução CRAZZY PROJECT.

Rota:
`/admin/tutorials`

Inclui:
- criar tutorial;
- editar;
- duplicar;
- draft/publicado;
- preview;
- versionamento;
- associar produto/plano;
- regras de acesso;
- criar seções/passos;
- drag and drop;
- ordenar blocos;
- mídia;
- caixas coloridas;
- keybinds;
- anexos;
- reordenação;
- publicar/despublicar.

### M46 — CRAZZY PARTNER: MT SOUNDS
Módulo técnico da incorporação da aplicação MT Sounds.

A experiência pública aparece em M23.1 e como última aba.
Este módulo técnico cuida da migração do source e isolamento do app parceiro.

### M47 — CRAZZY SECURITY SENTINEL
Módulo central de auditoria, detecção de abuso e alertas de segurança.

Objetivo:
registrar eventos críticos, bugs e sinais de tentativa de acesso indevido, enviando alertas seguros pelo bot Discord.

Inclui:
- bugs críticos e erros 5xx;
- falhas repetidas de API;
- tentativas de acessar rotas/admin sem permissão;
- tentativas de consultar estoque/keys sem autorização;
- tentativa de forçar endpoints administrativos;
- manipulação suspeita de payload/preço/quantidade;
- assinatura de webhook inválida;
- replay/webhook duplicado suspeito;
- tentativas repetidas de login;
- rate limit excedido;
- enumeração de IDs/recursos;
- tentativa de escalada de privilégio;
- falha de Discord role sync;
- falha de Fulfillment;
- erro de reserva/consumo de key;
- divergência de estoque;
- eventos sensíveis de refund/chargeback;
- eventos de segurança M06/LZT;
- eventos de segurança M08/PurinCash;
- eventos do M43 Fulfillment;
- eventos do M44 Discord Bridge;
- auditoria de ações administrativas críticas.

Saídas:
- log estruturado em banco;
- severidade INFO / WARN / HIGH / CRITICAL;
- request/session/user correlation id;
- painel de auditoria;
- alerta Discord;
- agregação/cooldown para evitar spam;
- deduplicação;
- acknowledge/resolution;
- trilha de auditoria para ações críticas.

Integrações:
- M24 Control Center;
- M27 Stock;
- M28 Sales;
- M29 Payments;
- M31 Customer 360;
- M40 Settings & Integrations;
- M41 Notify;
- M43 Fulfillment;
- M44 Discord Bridge.

Regras:
- não prometer detectar toda invasão;
- não expor API keys, tokens, senhas, keys/licenças ou conteúdo entregue em logs/Discord;
- mascarar IP/dados sensíveis quando apropriado;
- falha do Discord não pode derrubar checkout/auth/fulfillment;
- alertas críticos podem mencionar cargo de segurança configurável;
- painel completo somente para admins autorizados.

Status:
PLANEJADO.


---

# REGRA DE DIREITOS

Compra não deve liberar coisas espalhadas manualmente.

Toda compra aprovada cria um ENTITLEMENT.

O entitlement poderá controlar:
- produto;
- plano;
- validade;
- key;
- tutorial;
- cargo Discord;
- library;
- suporte;
- benefício futuro.

Pedido é histórico comercial.
Entitlement é direito de uso.

---

# REGRA DE CARGOS DISCORD

Recomendação inicial:

- uma role por produto ou benefício, não uma role nova por cliente;
- role pode ter nome, emoji, cor e prioridade configurados no Product Manager;
- o bot atribui a role ao cliente após fulfillment;
- o chat CRAZZY usa a cor da role de maior prioridade;
- perfil mostra todas as roles permitidas;
- roles administrativas do Discord podem aparecer, mas não concedem acesso pago sozinhas.

---

# REGRA DE PAGAMENTO

Fonte de verdade do preço:
banco/servidor.

Nunca:
- confiar em total enviado pelo browser;
- liberar por successUrl;
- processar webhook sem assinatura;
- processar o mesmo webhook duas vezes;
- entregar antes de validar valor;
- gravar chave PurinCash no client;
- logar key/licença entregue em texto aberto.

---

# GATE ATUAL

1. M05 está tecnicamente pronto e aguarda aprovação.
2. M06 NÃO começou.
3. Antes de M06 serão fechadas as decisões pendentes de:
   - fonte das keys;
   - padrão de cargo Discord;
   - expiração de cargo/tutorial;
   - integração MT Sounds;
   - estratégia PurinCash supplier.
