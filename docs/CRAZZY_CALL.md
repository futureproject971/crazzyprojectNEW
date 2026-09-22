# CRAZZY CALL

CRAZZY CALL é o módulo de chamadas e compartilhamento em tempo real do CRAZZY PROJECT.

## Arquitetura

O módulo reutiliza o Supabase Auth já existente. Não existe segundo sistema de login.

- **Next.js / React / TypeScript**: interface, lobby, sala e Route Handlers.
- **Supabase**: salas, participantes, chat, eventos, permissões e histórico.
- **LiveKit / WebRTC**: microfone, câmera, screen share, áudio e distribuição dos tracks.
- **Picture-in-Picture**: API nativa do navegador sobre o stream selecionado.

Vídeo e áudio nunca são armazenados no Supabase.

## Rotas

- `/call`: central CRAZZY CALL.
- `/call/[code]`: lobby e sala.
- `/admin/calls`: supervisão administrativa de metadados.
- `/api/call/*`: create, list, preview, join, room, token, presence, leave, lock, role, kick, end e messages.

O código da sala é aleatório e o link não contém JWT, API key ou segredo.

## Variáveis de ambiente

Use os placeholders de `.env.example`.

### Browser-safe

```env
NEXT_PUBLIC_LIVEKIT_URL=wss://SEU-PROJETO.livekit.cloud
```

### Somente servidor

```env
LIVEKIT_URL=https://SEU-PROJETO.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

**Nunca** use prefixo `NEXT_PUBLIC_` no API key/secret.

## Banco

Migrations:

- `supabase/migrations/202609220230_crazzy_call.sql`
- `supabase/migrations/202609220235_crazzy_call_privileges.sql`
- `supabase/migrations/202609220240_crazzy_call_table_privileges.sql`

Tabelas:

- `call_rooms`
- `call_participants`
- `call_messages`
- `call_events`

Todas usam RLS. Ações sensíveis passam por RPC autenticado e validação server-side.

## LiveKit

O backend cria tokens curtos. O browser recebe somente o token temporário necessário para entrar na sala.

A sala de mídia usa um nome interno baseado no UUID da sala, não no nome/e-mail do usuário.

Configuração do cliente:

- adaptive stream;
- dynacast;
- background video pause desativado para manter PiP funcional quando a aba perde foco;
- resolução de captura inicial 720p;
- seletor de recepção AUTO / 720p / 1080p e 30 / 60 FPS, sujeito à disponibilidade real do track e conexão.

## Screen share

O botão usa LiveKit para iniciar a captura do navegador. O navegador mostra o seletor nativo de tela, janela ou aba.

Quando disponível, é solicitado áudio da captura. Se o browser não entregar um track de áudio, a interface informa o usuário.

Múltiplos participantes podem compartilhar simultaneamente. Cada screen share vira um preview e o usuário escolhe qual fica no player principal.

## Picture-in-Picture real

O PiP usa a API nativa:

- `document.pictureInPictureEnabled`;
- `video.requestPictureInPicture()`;
- `document.exitPictureInPicture()`;
- `enterpictureinpicture`;
- `leavepictureinpicture`.

A janela PiP usa o stream selecionado no momento em que o usuário entra no PiP.

Selecionar outro preview **não troca silenciosamente** o PiP. A interface mostra `TROCAR TRANSMISSÃO NO PiP`, que fecha a sessão atual e abre a nova transmissão.

Se o track do PiP terminar ou desaparecer, o PiP é encerrado e a interface mostra `Esta transmissão foi encerrada.`.

O PiP recebe o track de áudio do screen share quando ele existe, respeitando mute, volume e políticas do navegador.

Se a API não existir, o botão fica desabilitado e informa que o navegador não suporta PiP.

## Host e co-host

Host:

- tranca/destranca;
- promove/remove co-host;
- remove participante;
- encerra a sala;
- copia link.

Co-host:

- pode moderar participantes comuns;
- não pode alterar o host;
- não pode remover outro co-host;
- não pode encerrar a sala inteira.

Admin global pode encerrar uma sala pelo painel administrativo, mas não recebe acesso oculto ao áudio/vídeo.

## Chat

Mensagens passam pelo backend, possuem limite de tamanho e rate limit básico no banco. A leitura em tempo real usa Supabase Realtime.

HTML bruto do usuário não é renderizado.

## Reconexão

LiveKit controla os estados de WebRTC:

- connecting;
- connected;
- reconnecting;
- disconnected.

A interface sinaliza reconexão e mantém heartbeat leve no Supabase para histórico. O campo de presença do banco não substitui o estado real do LiveKit.

## Testes

Execute:

```bash
npm ci
npm run typecheck
node scripts/test-crazzy-call.mjs
npm run build
```

O smoke test verifica:

- RPCs do CALL bloqueados para anônimos;
- tabelas sem leitura anônima;
- ausência de referência a secrets nos componentes client;
- presença da API nativa de Picture-in-Picture.

Testes manuais ainda são necessários para mídia real, pois dependem de permissões de browser, dois usuários e LiveKit configurado.

## Deploy

O site pode continuar em Vercel ou em hospedagem Next.js compatível. LiveKit permanece separado da hospedagem web.

Configure as variáveis secretas diretamente no painel do deploy. Não cole o secret em arquivos do repositório.

## Limitações reais

1080p60 não é garantido. Qualidade depende do browser, máquina, track publicado, rede, simulcast e LiveKit.

Áudio do sistema também não é universal. O navegador e o sistema operacional decidem quais opções de captura oferecem.
