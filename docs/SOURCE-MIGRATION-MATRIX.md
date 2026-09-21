# CRAZZY PROJECT — SOURCE MIGRATION MATRIX

## Princípio

Se a função antiga vende/entrega/suporta o mesmo tipo de produto que vendemos hoje, ela deve ser auditada antes de decidirmos recriar.

## Matriz

| Recurso | Fonte preferida | Estratégia |
|---|---|---|
| Visual / design / layout | CRAZZY PROJECT | manter |
| LZT Accounts | FortuneECrazzy | migrar e adaptar |
| Raspadinha UI | Pink | migrar visual |
| Raspadinha RNG | Pink | NÃO copiar; reescrever server-side |
| Cupons | Pink/Fortune | estudar e adaptar |
| Estoque de keys | Pink/Fortune + arquitetura nova | migrar conceitos, endurecer atomically |
| PIX PurinCash | IFOOD 420 + docs oficiais | migrar padrão robusto |
| Cartão PurinCash | IFOOD 420 + docs oficiais | migrar padrão robusto |
| LTC PurinCash | docs oficiais | implementar novo |
| Webhook/idempotência | IFOOD 420 + docs oficiais | migrar/fortalecer |
| Entrega PurinCash supplier | docs oficiais | opcional por produto |
| Discord roles | arquitetura nova | criar integração própria |
| Discord profile/role colors | Discord behavior + CRAZZY UI | criar |
| Tutorial viewer | CRAZZY | expandir M22 |
| Tutorial editor | novo | criar M45 |
| Entitlement/Fulfillment | novo | criar M43 |
| MT Sounds | site existente | migrar source |
| Admin product manager | CRAZZY + Pink/Fortune ideas | expandir M25 |
| Pagamentos admin | CRAZZY + IFOOD 420 | expandir M29 |
| Financeiro | Pink/Fortune/IFOOD ideas | adaptar M30 |

## Regra de decisão

### MIGRAR quando
- existe código funcional;
- a regra de negócio é a mesma;
- reduz risco;
- não traz acoplamento ruim;
- pode ser isolado.

### RECRIAR quando
- código antigo é inseguro;
- estado vive no frontend;
- regra é incompatível;
- arquitetura antiga duplica responsabilidades;
- integração nova possui API melhor.

### MIGRAR + CORRIGIR quando
- ideia é boa, implementação tem risco.

Exemplos:
- Raspadinha Pink;
- pagamento IFOOD;
- estoque antigo.

## Pergunta obrigatória antes de uma reescrita grande

Se encontrarmos função semelhante no Fortune, Pink, IFOOD 420 ou MT Sounds:
1. comparar;
2. explicar o que existe;
3. recomendar migrar ou recriar;
4. perguntar ao usuário quando a decisão alterar comportamento/negócio.
