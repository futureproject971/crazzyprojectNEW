# M06 — PREFLIGHT BEFORE IMPLEMENTATION

Status: **M06 EM ANDAMENTO — integração LZT será configurada pela primeira vez.**

## Estado real confirmado em 2026-09-21

O usuário confirmou que **nunca configurou LZT antes**. Portanto:
- não existe token LZT antigo para recuperar;
- não existe integração live antiga que precise ser preservada;
- FortuneECrazzy permanece como referência histórica de UI/regras quando o source estiver disponível;
- a integração oficial CRAZZY PROJECT será feita agora usando a API oficial LZT Market;
- o adapter atual do CRAZZY PROJECT é a base técnica do M06.

## Requisitos oficiais LZT

- criar um API Client na conta LZT;
- gerar Access Token com scope `market`;
- armazenar o token apenas no backend;
- nunca usar token em `NEXT_PUBLIC_*`, browser, GitHub ou logs;
- buscas de categoria têm limite de 20/minuto, portanto o adapter aplica fila global de 3,1s.

## Implementado

- [x] branch `m06-accounts-market`;
- [x] /contas;
- [x] /contas/[id];
- [x] VALORANT adapter;
- [x] LoL adapter;
- [x] Fortnite adapter;
- [x] Minecraft adapter;
- [x] detalhe sanitizado;
- [x] token somente backend;
- [x] BRL direto no provider via `lzt_config.currency`;
- [x] rate-limit global server-side;
- [x] smoke test automático;
- [x] TypeScript/build/CI passando;
- [ ] credencial LZT criada e instalada;
- [ ] smoke real com provider autenticado;
- [ ] fórmula final de markup aprovada;
- [ ] compra/entrega integrada ao M43.

## Gate técnico restante

M06 só pode sair de draft quando:
1. o usuário criar seu primeiro token LZT com scope `market`;
2. o token for salvo como `LZT_MARKET_TOKEN` em Edge Function Secrets;
3. smoke Riot/LoL + Fortnite + Minecraft passar de verdade;
4. markup comercial for confirmado;
5. compra/entrega for definida sem expor fast-buy ao browser.
