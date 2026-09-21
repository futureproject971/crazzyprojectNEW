# M06 — PREFLIGHT BEFORE IMPLEMENTATION

Status: **LIBERADO PARA INÍCIO após merge do M05 e Architecture V2.**

## Fonte obrigatória
FortuneECrazzy / integração LZT existente.

## Não fazer
- recriar API LZT do zero sem motivo;
- inventar filtros que já existem;
- copiar visual antigo;
- misturar M06 com Product View;
- começar backend de pagamento junto;
- alterar regras D01-D10 sem nova decisão explícita do usuário.

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

## Decisões D01-D10
**FECHADAS em 2026-09-21.**

Resumo:
- keys híbridas, com `internal_stock` padrão;
- roles no formato `emoji | PRODUTO`;
- cargo expira com o plano;
- tutorial permanece após expiração normal;
- bot CRAZZY reaproveitado quando saudável, com sync isolado;
- PurinCash é gateway e CRAZZY é fonte de verdade;
- tutorial por produto/plano e vídeo por upload + link/embed;
- MT Sounds será portado para Next.js; source ainda é dependência futura do M46;
- refund/dispute revoga entitlement/cargo/novos acessos protegidos e mantém evidências;
- nick usa cor da maior role visível;
- Security Sentinel usa `#security-logs` por padrão e role configurável somente em CRITICAL.

## Gate
- [x] D01-D10 aprovadas.
- [ ] PR #6 M05 mergeado.
- [ ] PR #7 Architecture V2 mergeado.
- [ ] branch `m06-accounts-market` criada a partir da base consolidada.

Após os três itens acima, M06 pode iniciar pela **auditoria/migração do FortuneECrazzy/LZT**, nunca do zero.
