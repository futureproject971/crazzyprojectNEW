# M06 — PREFLIGHT BEFORE IMPLEMENTATION

M06 ainda NÃO iniciou.

## Fonte obrigatória
FortuneECrazzy / integração LZT existente.

## Não fazer
- recriar API LZT do zero sem motivo;
- inventar filtros que já existem;
- copiar visual antigo;
- misturar M06 com Product View;
- começar backend de pagamento junto.

## Migrar
- listagem de contas;
- chamadas LZT;
- markup;
- filtros;
- detalhes;
- dados específicos de Valorant;
- dados específicos de LoL;
- dados específicos de Fortnite;
- dados específicos de Minecraft.

## Adaptar
- React/Vite antigo -> Next.js/App Router;
- UI -> CRAZZY DESIGN SYSTEM;
- dados -> camada de serviço isolada;
- erros/loading/empty;
- desktop/tablet/mobile.

## Decisões que precisam ser fechadas antes do backend final
1. fonte de estoque/key;
2. regra de cargo Discord;
3. expiração do cargo;
4. acesso de tutorial após expiração;
5. uso ou não do PurinCash supplier;
6. source/repo do MT Sounds.

## Gate
M05 precisa ser aprovado/mergeado antes de iniciar M06.
