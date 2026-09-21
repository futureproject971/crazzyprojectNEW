# M07 — CRAZZY CART + COMBO RULES

Status: **política comercial de carrinho definida em 2026-09-21.**

## Planos padrão CRAZZY PROJECT

Produtos comuns usam planos pré-definidos pelo sistema. O operador cadastra o nome do produto uma única vez.

Planos padrão:
- `1d` — Diário — 1 dia
- `3d` — 3 Dias
- `7d` — 7 Dias
- `15d` — 15 Dias
- `30d` — Mensal — 30 dias
- `90d` — 90 Dias
- `lifetime` — Lifetime

Não cadastrar nomes repetidos como:
- VALORANT 1 DIA
- VALORANT 7 DIAS
- VALORANT 30 DIAS

Cadastrar apenas:
- VALORANT

O sistema associa automaticamente as variações de plano.

## Estoque e visibilidade

Regra oficial:
- plano com estoque > 0: aparece e é vendável;
- plano com estoque = 0: fica oculto por padrão;
- plano com estoque = 0 + `showWhenOutOfStock=true`: aparece como esgotado;
- operador escolhe se deseja ocultar ou mostrar esgotado.

Objetivo:
- o operador só precisa criar o produto;
- depois abastece preço/estoque das variações necessárias;
- não repete nome de produto para cada duração.

## Combo CRAZZY

Somente dois grupos de combo:
- Mensal / `30d`
- Lifetime / `lifetime`

As famílias são calculadas separadamente.

Faixas:
- 2 produtos diferentes: 10% OFF
- 3 produtos diferentes: 15% OFF
- 4 produtos diferentes: 20% OFF
- 5 produtos diferentes: 25% OFF
- 6 produtos diferentes: 30% OFF
- 7 ou mais produtos diferentes: 35% OFF

**35% é o teto máximo.**

## Regras anti-abuso do combo

- somente produtos diferentes contam para subir de faixa;
- quantidade repetida do mesmo produto não aumenta desconto;
- Mensal e Lifetime não somam quantidade entre si;
- contas LZT não entram no combo;
- serviços/custom não entram no combo;
- somente itens marcados como combo-eligible entram no cálculo;
- o cálculo definitivo será refeito server-side no checkout;
- o browser nunca será fonte de verdade para desconto.

## Cupom + combo

Regra:
- cupom e combo não acumulam;
- no checkout será aplicado o benefício válido mais vantajoso;
- cupom continua validado server-side;
- o cliente não escolhe manualmente como empilhar descontos.

## Carrinho

O M07 mantém:
- carrinho global;
- persistência local;
- produto + plano;
- conta LZT;
- quantidade;
- alteração de plano;
- remoção;
- limpar carrinho;
- cupom salvo para validação;
- combo progressivo;
- subtotal;
- desconto visual;
- total;
- quick cart/drawer;
- página `/carrinho`;
- página `/combo`;
- responsividade;
- loading/error/empty.

## Segurança comercial

Se preço autoritativo não existir:
- mostrar `Consultar` / `A definir`;
- não inventar valor;
- não liberar checkout.

M08 deve recalcular:
- preço;
- estoque;
- elegibilidade;
- combo;
- cupom;
- total final;
- antes de criar pagamento.
