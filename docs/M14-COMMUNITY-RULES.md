# M14 — CRAZZY COMMUNITY

Status: implementado; QA final/PR pendentes neste branch.

## Escopo

Community privado para usuários autenticados:
- canal Geral;
- mensagens reais;
- reply;
- reações;
- perfil clicável estilo Discord;
- app roles;
- cargos Discord já concedidos;
- badges;
- mídia privada de imagem/vídeo/áudio;
- soft delete;
- polling seguro.

## Domínio

Tabelas próprias:
- community_channels
- community_messages
- community_reactions
- community_attachments

Não reutiliza support_messages nem ticket_messages.

## Identidade

Reaproveita:
- profiles
- profile_preferences
- user_roles
- discord_identities
- discord_role_grants
- entitlements

Não existe perfil paralelo de Community.

## Cor/cargo principal

Até M44 fornecer prioridade/cor oficial dos cargos Discord:
1. admin
2. moderator
3. cargo Discord concedido mais recente
4. MEMBER

Cores seguras:
- ADMIN: rosa
- MOD: dourado
- cargo Discord: azul CRAZZY
- MEMBER: azul claro

A cor pessoal do M12 não concede permissão nem cargo.

## Perfil clicável

Exibe somente snapshot seguro:
- avatar
- display name
- bio
- cargo principal
- badges
- Discord conectado/verificado
- cargos Discord concedidos
- contagem de entitlements

Não exibe:
- email
- IP
- ban reason
- pagamentos
- keys
- Library secrets
- tokens

## Replies

community_messages.reply_to_message_id:
- precisa apontar para mensagem do mesmo canal;
- mensagem removida continua com referência segura;
- conteúdo removido não reaparece no reply.

## Reações

Allowlist:
- 🔥
- 💎
- 💙
- ❤️
- 👍
- 😂
- 🎮
- 👀
- 💯
- 🚀

Unique:
message_id + user_id + emoji.

Backend usa toggle.

## Mídia

Bucket:
community-media

Configuração:
- private;
- 20 MB por arquivo;
- sem policy pública;
- signed upload URL;
- signed URL de leitura de 10 minutos;
- até 4 arquivos selecionados por mensagem na UI;
- até 6 attachments por mensagem no backend.

Tipos:
- PNG/JPEG/WEBP/GIF
- MP4/WEBM
- MPEG/MP3/OGG/WEBM audio

Sem executáveis.

## Escrita

Browser não tem INSERT/UPDATE/DELETE direto nas tabelas Community.

Mutações passam pela Edge Function community v1:
- snapshot
- profile
- message
- reaction
- delete-message
- upload-url
- finalize-attachment

A identidade do autor vem do JWT validado.

## Rate limit

- mensagens: 20/minuto por usuário
- reações: 60/minuto por usuário
- anexos: limite 6 por mensagem

## Delete

Usuário pode apagar própria mensagem.
Admin/mod também podem apagar no backend.

É soft delete:
- deleted_at preenchido;
- UI não retorna body/mídia depois disso.

M33 continuará responsável por moderação completa.

## Atualização do chat

Primeiro corte usa polling seguro a cada 4 segundos apenas quando a aba está visível.

Supabase Realtime privado foi estudado, mas não é requisito para M14. O schema pode evoluir para Broadcast privado depois sem mudar a fonte de verdade das mensagens.

## Rotas

- /comunidade
- /api/community
- /api/community/profile/[id]
- /api/community/messages
- /api/community/reactions
- /api/community/messages/[id]/delete
- /api/community/messages/[id]/attachments/upload-url
- /api/community/attachments/[id]/finalize

/comunidade é privada e redireciona visitante para login.

## Segurança

Após migration:
- anon sem SELECT nas tabelas Community;
- authenticated com SELECT via RLS;
- authenticated sem INSERT direto;
- authenticated sem UPDATE direto;
- authenticated sem DELETE direto;
- bucket public=false;
- conta banida bloqueada;
- Security Advisor: 0 lints.

## Boundaries

M14:
- chat e experiência Community.

M20:
- ranking.

M33:
- moderação avançada.

M44:
- prioridade/cor/sync oficial Discord.

M47:
- segurança e alertas estruturados.
