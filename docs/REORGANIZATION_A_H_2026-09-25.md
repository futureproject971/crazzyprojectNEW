# CRAZZY PROJECT NEW — Auditoria e reorganização A–H
Data: 2026-09-25

## Fonte de verdade
- Repositório: futureproject971/crazzyprojectNEW
- O repositório antigo não participa desta reorganização.

## FASE A — Auditoria
Inventário do NEW no início desta consolidação:
- 77 rotas de página no App Router
- 95 rotas de API
- 52 módulos em src/modules
- 54 migrations SQL do Supabase
- 8 grupos de Edge Functions fora de _shared/_backups
- CRAZZY CALL, MTSOUNDS, Academy, Help, Community, Support, Reviews, Accounts Market, Library, Status, Auth Discord, Checkout, Club, Rewards, Luck, Coupons, Rank, Admin Managers e Commerce preservados.

Regra: nenhum recurso é removido apenas por parecer redundante. Primeiro ele é classificado e recebe uma casa na arquitetura.

## FASE B — 6 centrais
1. Visão Geral — operação, alertas e atalhos
2. Produtos — Product Manager, categorias, estoque e tutoriais
3. Clientes — Customer 360, suporte, comunidade e CRAZZY CALL
4. Vendas — vendas, pagamentos, financeiro, fulfillment, revendedores e parceiros
5. CRAZZY Club — FREE/Rewards, Luck, roleta, raspadinha, cupons e bônus
6. Sistema — Discord, integrações, aparência, segurança, notificações e campanhas

Princípio: poucas portas, salas grandes e bem organizadas.

## FASE C — Product Manager
- Criar e editar no mesmo módulo
- Planos e estoque no fluxo do produto
- Filtros: Todos, Online, Offline, Novos, Atualizando e Sem estoque
- Presets de plano existentes preservados
- Entrega, mídia e integrações ficam no produto
- IDs técnicos não são informação primária de interface

## FASE D — Customer 360
- Busca por nome, e-mail e Discord
- UUID permanece interno
- Conta, Discord, pedidos, pagamentos, entregas e CRAZZY Club agregados
- CRAZZY BONUS ajustável a partir do cliente
- Bonus Manager não pede UUID

## FASE E — CRAZZY Club
- Hub único para FREE, Rewards, Luck, roleta, raspadinha, cupons, bônus e progressão
- FREE e PRÊMIOS ganham destaque próprio na navegação do cliente
- Roleta visual segmentada, com ponteiro lateral e parada calculada pelo prêmio retornado pelo backend
- Cupom suporta todos os produtos ou produtos selecionados e clientes encontrados por busca humana

## FASE F — Commerce
- Vendas, pagamentos, financeiro, fulfillment, revendedores e parceiros agrupados em Vendas
- A lógica financeira e de pagamento existente é preservada
- Operações administrativas deixam de depender de dialogs nativos

## FASE G — Client UX
- Navegação principal reduzida
- FREE e PRÊMIOS aparecem como destinos explícitos
- MTSOUNDS continua destacado
- CRAZZY Club concentra o ecossistema de recompensa
- Copy curta e orientada a ação

## FASE H — Limpeza
- Remoção de prompt/confirm/alert nativos nos managers auditados
- Confirmações e entradas operacionais usam modal interno
- Bonus Manager foi simplificado para regras por plano e encaminha ajuste individual ao Customer 360
- Textos de interface evitam UUID, SQL, Supabase e detalhes internos quando não são necessários ao cliente/admin
- Dados e migrations existentes são preservados

## Regra técnica
O banco pode ser complexo e o código modular. A interface não precisa expor essa complexidade.
