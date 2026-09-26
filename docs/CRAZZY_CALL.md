# CRAZZY CALL • CRAZZY SCREEN ENGINE

CRAZZY CALL é o módulo de compartilhamento de tela em tempo real do CRAZZY PROJECT.

## Regra de arquitetura

CRAZZY CALL **não é um Google Meet**.

- **Discord**: voz, comunidade, presença e XP.
- **CRAZZY CALL**: compartilhar tela, assistir transmissões, chat, PiP e moderação.
- **LiveKit / WebRTC / SFU**: transporte e distribuição dos tracks.
- **Supabase**: autenticação, salas, permissões, chat, histórico e vínculo com a call Discord.
- **Discord Bot Core**: salas temporárias, handoff e presença real na voz.

A aplicação não captura, publica ou pede permissão de câmera/microfone.

## Login e presença Discord

A página e a API continuam exigindo a conta Discord vinculada e presença na guild.

Para uma CRAZZY CALL criada pelo bot e vinculada a uma sala de voz:

1. o usuário precisa estar autorizado em `voice_members`;
2. precisa estar fisicamente presente na call Discord;
3. existe uma tolerância curta configurada por `voice_settings.media_grace_seconds`;
4. passado esse tempo fora da voz, o bot remove o participante do LiveKit;
5. novos tokens LiveKit também são bloqueados enquanto a presença de voz não voltar.

Salas antigas/site-only que não possuem vínculo com `voice_rooms` continuam compatíveis.

## Token LiveKit

Tokens são curtos e criados apenas no servidor.

Fontes permitidas para publicação:

- `SCREEN_SHARE`
- `SCREEN_SHARE_AUDIO`

Fontes não permitidas:

- câmera;
- microfone.

O browser nunca recebe `LIVEKIT_API_SECRET` ou `SUPABASE_SERVICE_ROLE_KEY`.

## Screen Engine

O compartilhamento não usa mais controles de recepção fingindo criar 1080p/60.

A captura é configurada **no transmissor**.

Perfis:

### AUTO

Equilibra qualidade e estabilidade. Usa simulcast e permite que LiveKit faça adaptação de banda.

### NITIDEZ

Alvo de 1920×1080 a ~30 FPS.

- `contentHint = detail`
- `degradationPreference = maintain-resolution`
- encoding de screen share 1080p30
- indicado para texto, navegador, menus, código e desktop

### GAME

Tenta captura real 1920×1080 a até 60 FPS.

- `contentHint = motion`
- `degradationPreference = maintain-framerate`
- limite de encoding de até 60 FPS
- se a rede/encoder apertar, preservar movimento é prioridade

1080p60 nunca é prometido. O resultado real depende do browser, GPU/CPU, fonte escolhida e rede.

## Áudio da tela

Áudio da tela inicia **OFF**.

Quando habilitado:

- a captura usa `audio: true`;
- solicita `systemAudio: include`;
- publica somente como `SCREEN_SHARE_AUDIO`;
- microfone continua proibido.

A interface avisa que compartilhar o monitor inteiro pode capturar também o áudio do Discord. Para evitar eco, prefira aba/aplicativo ou mantenha o áudio da tela desligado.

Browsers não garantem áudio para toda origem de captura.

## Conexão e recuperação

O cliente mantém:

- `adaptiveStream`;
- `dynacast`;
- reconexão nativa do LiveKit;
- `prepareConnection()` antes de conectar;
- eventos de conexão, qualidade, stream pausado e falha de subscription.

Não foi copiado o sistema de ICE/TURN do VDO.Ninja. LiveKit continua responsável por SFU, relay e reconexão.

## Telemetria local

O player principal lê `getRTCStatsReport()` aproximadamente a cada 2 segundos e mostra, quando o browser fornece:

- resolução real;
- FPS real;
- bitrate;
- RTT;
- jitter;
- packets lost;
- NACK;
- PLI;
- codec;
- `qualityLimitationReason`;
- qualidade de conexão LiveKit.

Os dados são usados apenas na interface/diagnóstico. Endereços IP e candidatos ICE não são armazenados.

## Múltiplas telas

Vários participantes podem compartilhar simultaneamente.

Cada screen share aparece como preview e o usuário escolhe qual transmissão fica no player principal. `adaptiveStream` e `dynacast` continuam responsáveis por reduzir trabalho desnecessário do SFU/client.

## Picture-in-Picture

PiP continua usando a API nativa do navegador:

- `document.pictureInPictureEnabled`
- `requestPictureInPicture()`
- `exitPictureInPicture()`
- eventos `enterpictureinpicture` e `leavepictureinpicture`

Não existe PiP falso em CSS.

## VDO.Ninja

O source do VDO.Ninja foi estudado como referência técnica de:

- captura;
- hints de conteúdo;
- adaptação;
- telemetria;
- comportamento em redes ruins;
- robustez de screen sharing.

Código VDO.Ninja **não foi copiado**. O projeto é AGPLv3 e CRAZZY CALL continua implementado sobre APIs LiveKit/WebRTC próprias.

## Testes

Executar:

```bash
npm ci
npm run typecheck
node scripts/test-crazzy-call.mjs
node scripts/test-all-modules.mjs
npm run build
npm --prefix apps/discord-bot run check
```

O smoke deve falhar se:

- `setCameraEnabled` voltar ao runtime;
- `setMicrophoneEnabled` voltar ao runtime;
- o token autorizar CAMERA ou MICROPHONE;
- o bot voltar a anunciar webcam;
- screen share/audio deixarem de ser as únicas fontes publicáveis;
- o gate da call Discord desaparecer;
- PiP deixar de ser nativo.

Mídia real ainda exige teste manual com browser e LiveKit porque seletor de tela, áudio do sistema, resolução e FPS dependem da plataforma.
