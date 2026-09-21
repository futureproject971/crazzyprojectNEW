# LZT MARKET — PRIMEIRA CONFIGURAÇÃO CRAZZY PROJECT

Status: **aguardando somente o primeiro Access Token do usuário.**

## 1. Criar acesso no LZT

A documentação oficial exige:
- API Client;
- Access Token;
- scope `market`.

A conta LZT também precisa ter acesso ao Market API conforme as regras atuais do serviço.

Documentação oficial:
https://lzt-market.readme.io/reference/information

## 2. Salvar no Supabase

Método preferido:
1. Supabase Dashboard;
2. Edge Functions;
3. Secrets;
4. adicionar:
   - Key: `LZT_MARKET_TOKEN`
   - Value: token gerado no LZT;
5. Save.

O token NÃO deve ser:
- colado em código;
- colocado em `.env` commitado;
- colocado em `NEXT_PUBLIC_*`;
- enviado para o navegador;
- registrado em logs.

O Supabase disponibiliza secrets para Edge Functions imediatamente, sem redeploy.

## 3. Arquitetura já pronta

- Edge Function: `lzt-market`;
- listagem sanitizada: `action=preview-v2`;
- detalhe sanitizado: `action=preview-detail-v2`;
- jogos:
  - VALORANT;
  - League of Legends;
  - Fortnite;
  - Minecraft;
- moeda: `BRL` via `lzt_config.currency`;
- `fast-buy` não é exposto ao frontend;
- rate-limit global: 3,1 segundos entre buscas do provider;
- fila acima de 15s retorna 429 + Retry-After.

## 4. Validação automática

Após instalar o token, o GitHub Actions executa:
`node scripts/test-lzt-preview.mjs`

Esperado:
- Riot/LoL: PASS;
- Fortnite: PASS;
- Minecraft: PASS.

Enquanto a chave não existe, o teste retorna `BLOCKED credential missing` e a UI mostra `CREDENCIAL PENDENTE`.

## 5. Preço

- provider é consultado diretamente em BRL;
- custo do provider fica server-side;
- `lzt_config` possui markup global e por jogo com default 1.5;
- preço final ainda NÃO é exibido até a fórmula comercial ser confirmada.

## 6. Segurança

- token somente backend;
- payload público sanitizado;
- Security Advisor Supabase: 0 lints após implementação;
- rate limiter acessível somente por `service_role`;
- nunca usar tokens públicos encontrados em terceiros.
