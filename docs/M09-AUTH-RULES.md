# M09 — CRAZZY AUTH

Status: **estrutura concluída; credenciais OAuth/provider serão ativadas na etapa de integrações.**

## Princípio

O site continua público.

Autenticação é exigida apenas para áreas privadas, incluindo:
- checkout;
- painel do cliente;
- perfil;
- tickets;
- chat;
- rotas privadas futuras.

Não existe guest checkout inseguro.

## Provedores

### Discord
Provedor principal.

Scopes:
- `identify`
- `email`
- `guilds`

No callback:
1. Supabase troca o PKCE code por sessão;
2. o access token Supabase é validado;
3. o provider token Discord é enviado server-to-server para `auth-discord-sync`;
4. a função consulta Discord API v10;
5. grava apenas identidade/status verificado;
6. o provider token Discord NÃO é persistido.

### Google
Opcional.

Feature flag:
`NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true`

Por padrão permanece desligado até o provider ser configurado.

## Discord guild status

Tabela:
`public.discord_identities`

Campos principais:
- `discord_user_id`
- username/global_name
- avatar
- guild id
- guild member
- verified at
- last checked

`DISCORD_GUILD_ID` pode vir de:
1. Edge Secret;
2. `system_credentials` admin-only.

Guild membership é um atributo verificado, não uma trava para navegar no site inteiro.

Recursos futuros podem exigir membership individualmente.

## Conta e roles

Todo novo usuário recebe automaticamente:
- profile;
- role `user`.

Roles existentes:
- user;
- moderator;
- admin.

Autorização usa banco/RLS. Nunca usar `user_metadata` para decidir permissões.

## Sessão

Pacotes pinados:
- `@supabase/supabase-js 2.109.0`
- `@supabase/ssr 0.12.0`

Motivo:
- 2.109.0 é a última linha Supabase JS compatível com Node 20;
- SSR 0.12.0 aceita `supabase-js ^2.108.0`.

Sessão:
- cookies SSR;
- middleware renova cookies;
- `getClaims()` para proteção;
- `getUser()` para identidade atual;
- `getSession()` apenas quando é necessário encaminhar access token já validado.

## Rotas

Públicas:
- `/login`
- `/cadastro` -> login social
- `/reset-password` -> explica recuperação via provedor social
- `/auth/callback`
- `/api/auth/me` retorna 401 sem sessão

Protegidas no middleware:
- `/checkout`
- `/painel`
- `/cliente`
- `/perfil`
- `/tickets`
- `/chat`

## App Shell

O header reage à sessão:
- visitante -> botões de login;
- user/moderator -> navegação cliente;
- admin -> navegação admin;
- avatar/nome reais;
- logout real.

## M08

O checkout deixou de procurar cookie placeholder.

Agora:
1. valida claims Supabase;
2. recupera access token da sessão;
3. encaminha Bearer token para PurinCash Edge Function;
4. backend continua recalculando tudo server-side.

## RLS / privacidade

`discord_identities`:
- anon: sem SELECT;
- authenticated: SELECT somente da própria linha ou admin;
- escrita: service role.

`profiles`:
- anon: sem SELECT;
- authenticated: própria linha ou admin;
- update: dono ou admin.

Trigger `handle_new_user`:
- SECURITY DEFINER;
- search_path vazio;
- execução direta revogada de public/anon/authenticated;
- utilizado apenas pelo trigger Auth.

## Ativação operacional futura

Supabase Auth Dashboard:
1. habilitar Discord provider;
2. informar Discord Client ID + Client Secret;
3. habilitar novos cadastros;
4. adicionar Site URL de produção;
5. allowlist:
   - produção `/auth/callback`
   - localhost quando necessário;
6. configurar `DISCORD_GUILD_ID`;
7. opcionalmente habilitar Google;
8. habilitar manual identity linking se Google -> Discord for utilizado.

Nenhum OAuth client secret deve ir para GitHub, browser ou `NEXT_PUBLIC_*`.
