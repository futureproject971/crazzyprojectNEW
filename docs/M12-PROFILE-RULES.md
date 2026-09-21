# M12 — CRAZZY PROFILE

Status: **implementação funcional concluída; QA final/PR pendentes neste branch.**

## Objetivo

Perfil privado do usuário em estilo Discord, integrado à identidade CRAZZY PROJECT.

O perfil mostra:
- nome;
- avatar;
- bio;
- cor principal;
- badges derivados;
- roles CRAZZY;
- cargos Discord;
- status da conexão Discord;
- estatísticas reais da conta.

## Fonte de verdade

Identidade protegida:
- `profiles`

Personalização segura:
- `profile_preferences`

Roles:
- `user_roles`

Discord:
- `discord_identities`
- `discord_role_grants`

Cliente/produtos:
- `entitlements`
- `payments`

## Separação de segurança

### profiles

Campos como:
- banned
- banned_at
- banned_reason
- username/avatar sincronizados

não são mais editáveis diretamente pelo usuário autenticado.

Após M12:
- authenticated: SELECT permitido conforme RLS;
- authenticated: sem INSERT/UPDATE/DELETE;
- service/backend continua podendo administrar.

A antiga policy de update owner/admin foi removida.

### profile_preferences

Campos editáveis:
- display_name
- bio
- primary_color
- avatar_source

RLS:
- owner lê sua linha;
- admin lê;
- owner insere/atualiza somente a própria linha;
- admin pode administrar.

Constraints no banco:
- display_name: 2–32 caracteres quando preenchido;
- bio: até 280 caracteres;
- primary_color: HEX #RRGGBB;
- avatar_source: auto/crazzy/discord.

A API também valida os mesmos limites server-side.

## Avatar

Fontes:
- auto
- CRAZZY
- Discord

Fallback automático:
- se a fonte escolhida não tiver avatar, usa a outra disponível.

Nenhuma URL de avatar arbitrária é gravada pelo cliente no M12.

## Badges

Badges não são autoatribuíveis.

São derivados de dados reais:
- CRAZZY MEMBER
- CLIENTE
- DISCORD VERIFICADO
- ADMIN
- MOD
- LIFETIME

Critérios:
- member: conta válida;
- customer: entitlement ou pagamento concluído;
- Discord verified: guild membership confirmado;
- admin/mod: user_roles;
- Lifetime: entitlement ativo com plan_code lifetime.

O usuário não recebe INSERT/UPDATE de badge.

## Roles

App roles vêm de `user_roles`.

Discord roles vêm de `discord_role_grants`.

M12 somente exibe.

O usuário NÃO:
- cria role;
- altera role;
- concede cargo Discord;
- muda prioridade/cor de role.

M44 continuará sendo o escritor de Discord grants.

## API

`GET /api/profile`
- exige sessão;
- monta snapshot privado;
- bloqueia conta banida;
- não usa user_id enviado pelo browser.

`PATCH /api/profile`
- exige sessão;
- valida display name;
- valida bio;
- valida cor;
- valida avatar source;
- upsert somente na preferência do próprio usuário.

## UI

Rota:
- `/perfil`

Já protegida pelo middleware M09.

Visual:
- card estilo Discord;
- banner usando cor principal;
- avatar sobreposto;
- status;
- badges;
- bio;
- roles;
- estatísticas;
- conexão Discord;
- edição inline segura.

## Identidade global

`/api/auth/me` passa a considerar:
- display_name;
- avatar_source.

Depois de salvar o perfil, o AuthProvider faz refresh.

Assim o header reflete o nome/Avatar escolhido sem alterar permissões.

## Discord

M12 permite:
- conectar Discord;
- atualizar/reautenticar Discord.

Não implementa grant/revoke de cargos.

## Segurança

Confirmado após migration:
- anon sem SELECT em profile_preferences;
- authenticated sem UPDATE/INSERT/DELETE em profiles;
- authenticated pode SELECT profiles somente conforme RLS;
- authenticated pode editar apenas profile_preferences;
- Security Advisor: 0 lints.

## Migration

`m12_profile_preferences`

Também atualiza `handle_new_user` para:
- criar protected profile;
- criar profile_preferences;
- criar role user.

## Próximo módulo

Somente após QA + PR + merge:
- M13 — CRAZZY SUPPORT.
