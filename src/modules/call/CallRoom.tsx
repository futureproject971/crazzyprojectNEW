"use client";

import { adminConfirm } from "@/core/ui/adminDialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConnectionState,
  RemoteParticipant,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrackPublication,
} from "livekit-client";
import type { AuthMe } from "@/modules/auth/types";
import { CallControls } from "./CallControls";
import { ChatPanel } from "./ChatPanel";
import { ParticipantList, type ParticipantMediaState } from "./ParticipantList";
import { ScreenSharePlayer, ScreenSharePreview } from "./ScreenSharePlayer";
import { usePictureInPicture } from "./usePictureInPicture";
import { useScreenShareEngine } from "./screen-share/useScreenShareEngine";
import type { ScreenShareProfile } from "./screen-share/profiles";
import type { ActiveScreenShare } from "./media-types";
import type {
  CallParticipant,
  CallParticipantRole,
  CallRoomSnapshot,
} from "./types";

type LiveKitCredentials = {
  token: string;
  url: string;
  roomName: string;
};

function collectMedia(room: Room) {
  const participants: Participant[] = [
    room.localParticipant,
    ...Array.from(room.remoteParticipants.values()),
  ];

  const shares: ActiveScreenShare[] = [];
  const mediaStates: ParticipantMediaState[] = participants.map((participant) => {
    const screenPublication = participant.getTrackPublication(Track.Source.ScreenShare);
    const audioPublication = participant.getTrackPublication(Track.Source.ScreenShareAudio);
    const videoTrack = screenPublication?.videoTrack;

    if (videoTrack) {
      shares.push({
        key: participant.identity + ":" + screenPublication.trackSid,
        participantIdentity: participant.identity,
        participantName: participant.name || participant.identity.slice(0, 8),
        isLocal: participant === room.localParticipant,
        videoTrack,
        audioTrack: audioPublication?.audioTrack,
        connectionQuality: participant.connectionQuality,
        remotePublication:
          participant instanceof RemoteParticipant
            ? (screenPublication as RemoteTrackPublication)
            : undefined,
      });
    }

    return {
      identity: participant.identity,
      screenShare: Boolean(videoTrack && !screenPublication?.isMuted),
    };
  });

  return { shares, mediaStates };
}

function friendlyCallError(code?: string) {
  const value = String(code || "");
  if (value.includes("ROOM_LOCKED")) return "Esta sala está bloqueada pelo host.";
  if (value.includes("ROOM_ENDED")) return "Esta sala já foi encerrada.";
  if (value.includes("DISCORD_VOICE_REQUIRED")) return "Volte para a call de voz do Discord para continuar usando a CRAZZY CALL.";
  if (value.includes("PARTICIPANT_KICKED") || value.includes("FORBIDDEN")) return "Você foi removido pelo host.";
  if (value.includes("LIVEKIT_NOT_CONFIGURED")) return "O CRAZZY CALL ainda não está conectado ao servidor LiveKit.";
  return "Não foi possível concluir esta ação.";
}

export function CallRoom({
  initialSnapshot,
  credentials,
  user,
}: {
  initialSnapshot: CallRoomSnapshot;
  credentials: LiveKitCredentials;
  user: AuthMe;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [liveRoom, setLiveRoom] = useState<Room | null>(null);
  const [shares, setShares] = useState<ActiveScreenShare[]>([]);
  const [mediaStates, setMediaStates] = useState<ParticipantMediaState[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>(ConnectionState.Connecting);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [profile, setProfile] = useState<ScreenShareProfile>("auto");
  const [screenAudio, setScreenAudio] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  const self = snapshot.participants.find((participant) => participant.user_id === user.id);
  const isOwner = snapshot.room.owner_id === user.id;
  const canModerate = isOwner || self?.role === "cohost" || user.role === "admin";
  const canEnd = isOwner || user.role === "admin";
  const canPublish = snapshot.room.allow_screen_share && (
    snapshot.room.room_mode === "call"
      ? self?.role !== "viewer"
      : self?.role === "host" || self?.role === "cohost"
  );

  const selectedShare = useMemo(
    () => shares.find((share) => share.key === selectedKey) || null,
    [selectedKey, shares],
  );

  const pip = usePictureInPicture({
    shares,
    muted,
    volume,
    onStreamEnded: useCallback(() => {
      setNotice("Esta transmissão foi encerrada.");
    }, []),
  });

  const refreshSnapshot = useCallback(async () => {
    const response = await fetch(
      "/api/call/room?code=" + encodeURIComponent(snapshot.room.code),
      { cache: "no-store" },
    );
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.snapshot) {
      setSnapshot(payload.snapshot as CallRoomSnapshot);
      return true;
    }
    if (response.status === 403) setNotice(friendlyCallError(payload.error));
    if (response.status === 409) setNotice("Esta sala foi encerrada.");
    return false;
  }, [snapshot.room.code]);

  const refreshMedia = useCallback((room: Room) => {
    const next = collectMedia(room);
    setShares(next.shares);
    setMediaStates(next.mediaStates);
  }, []);

  const handleScreenEnded = useCallback(() => {
    setNotice("Sua transmissão foi encerrada.");
    if (liveRoom) refreshMedia(liveRoom);
  }, [liveRoom, refreshMedia]);

  const screenEngine = useScreenShareEngine({
    room: liveRoom,
    profile,
    withAudio: screenAudio,
    enabled: Boolean(canPublish),
    onNotice: useCallback((message: string) => setNotice(message), []),
    onEnded: handleScreenEnded,
  });

  useEffect(() => {
    if (!selectedKey && shares.length) setSelectedKey(shares[0].key);
    if (selectedKey && !shares.some((share) => share.key === selectedKey)) {
      setSelectedKey(shares[0]?.key || null);
    }
  }, [selectedKey, shares]);

  useEffect(() => {
    const room = new Room({
      adaptiveStream: { pauseVideoInBackground: false },
      dynacast: true,
    });

    let cancelled = false;
    setLiveRoom(room);

    const onMediaChange = () => refreshMedia(room);

    room
      .on(RoomEvent.Connected, () => {
        if (cancelled) return;
        setConnection(ConnectionState.Connected);
        refreshMedia(room);
        void fetch("/api/call/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: initialSnapshot.room.id, connected: true }),
        });
      })
      .on(RoomEvent.Reconnecting, () => setConnection(ConnectionState.Reconnecting))
      .on(RoomEvent.Reconnected, () => {
        setConnection(ConnectionState.Connected);
        refreshMedia(room);
        void refreshSnapshot();
      })
      .on(RoomEvent.Disconnected, () => {
        setConnection(ConnectionState.Disconnected);
        refreshMedia(room);
        setNotice("Conexão encerrada. Se você saiu da call do Discord, volte à voz e reabra a CRAZZY CALL.");
        void refreshSnapshot();
      })
      .on(RoomEvent.ParticipantConnected, () => {
        onMediaChange();
        void refreshSnapshot();
      })
      .on(RoomEvent.ParticipantDisconnected, () => {
        onMediaChange();
        void refreshSnapshot();
      })
      .on(RoomEvent.ConnectionQualityChanged, onMediaChange)
      .on(RoomEvent.TrackStreamStateChanged, onMediaChange)
      .on(RoomEvent.TrackSubscriptionFailed, () => {
        setNotice("Uma transmissão não pôde ser carregada. A CRAZZY CALL vai tentar recuperar automaticamente.");
        onMediaChange();
      })
      .on(RoomEvent.TrackSubscribed, onMediaChange)
      .on(RoomEvent.TrackUnsubscribed, onMediaChange)
      .on(RoomEvent.TrackPublished, onMediaChange)
      .on(RoomEvent.TrackUnpublished, onMediaChange)
      .on(RoomEvent.LocalTrackPublished, onMediaChange)
      .on(RoomEvent.LocalTrackUnpublished, onMediaChange)
      .on(RoomEvent.TrackMuted, onMediaChange)
      .on(RoomEvent.TrackUnmuted, onMediaChange);

    void (async () => {
      try {
        await room.prepareConnection(credentials.url, credentials.token).catch(() => undefined);
        await room.connect(credentials.url, credentials.token);
        if (cancelled) return;
        refreshMedia(room);
      } catch {
        if (!cancelled) {
          setConnection(ConnectionState.Disconnected);
          setNotice("Não foi possível conectar ao servidor da CRAZZY CALL.");
        }
      }
    })();

    const heartbeat = window.setInterval(() => {
      if (room.state === ConnectionState.Connected) {
        void fetch("/api/call/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: initialSnapshot.room.id, connected: true }),
        });
      }
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      void pip.exit();
      room.disconnect();
      void fetch("/api/call/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: initialSnapshot.room.id, connected: false }),
        keepalive: true,
      });
    };
  }, [
    credentials.token,
    credentials.url,
    initialSnapshot.room.id,
    pip.exit,
    refreshMedia,
    refreshSnapshot,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => void refreshSnapshot(), 15000);
    return () => window.clearInterval(timer);
  }, [refreshSnapshot]);

  const localMedia = mediaStates.find((item) => item.identity === user.id);
  const screenShare = screenEngine.active || Boolean(localMedia?.screenShare);

  const toggleScreenShare = async () => {
    if (!liveRoom || !canPublish) return;
    setBusy("screen");
    setNotice(null);
    try {
      await screenEngine.toggle();
      refreshMedia(liveRoom);
    } finally {
      setBusy(null);
    }
  };

  const togglePip = async () => {
    if (!selectedShare) return;
    setBusy("pip");
    try {
      if (pip.active) await pip.exit();
      else await pip.enter(selectedShare);
    } catch {
      setNotice("Não foi possível abrir Picture-in-Picture.");
    } finally {
      setBusy(null);
    }
  };

  const switchPip = async () => {
    if (!selectedShare) return;
    setBusy("pip");
    try {
      await pip.switchTo(selectedShare);
    } catch {
      setNotice("Não foi possível trocar a transmissão no PiP.");
    } finally {
      setBusy(null);
    }
  };

  const fullscreen = async () => {
    if (!playerRef.current) return;
    try {
      await playerRef.current.requestFullscreen();
    } catch {
      setNotice("Tela cheia não está disponível neste navegador.");
    }
  };

  const lockRoom = async () => {
    setBusy("lock");
    try {
      const response = await fetch("/api/call/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: snapshot.room.id, locked: !snapshot.room.locked }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) setNotice(friendlyCallError(payload.error));
      else await refreshSnapshot();
    } finally {
      setBusy(null);
    }
  };

  const updateRole = async (participant: CallParticipant, role: CallParticipantRole) => {
    setBusy(participant.id);
    try {
      const response = await fetch("/api/call/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: snapshot.room.id, participantId: participant.id, role }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) setNotice(friendlyCallError(payload.error));
      else await refreshSnapshot();
    } finally {
      setBusy(null);
    }
  };

  const kick = async (participant: CallParticipant) => {
    if (!await adminConfirm("Confirmar ação", "Remover " + participant.display_name + " da CRAZZY CALL?")) return;
    setBusy(participant.id);
    try {
      const response = await fetch("/api/call/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: snapshot.room.id, participantId: participant.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) setNotice(friendlyCallError(payload.error));
      else await refreshSnapshot();
    } finally {
      setBusy(null);
    }
  };

  const leave = async () => {
    setBusy("leave");
    await screenEngine.stop();
    await pip.exit();
    liveRoom?.disconnect();
    await fetch("/api/call/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: snapshot.room.id }),
    }).catch(() => undefined);
    window.location.assign("/call");
  };

  const end = async () => {
    if (!await adminConfirm("Confirmar ação", "Encerrar esta CRAZZY CALL para todos?")) return;
    setBusy("end");
    const response = await fetch("/api/call/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: snapshot.room.id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(friendlyCallError(payload.error));
      setBusy(null);
      return;
    }
    await screenEngine.stop();
    await pip.exit();
    liveRoom?.disconnect();
    setNotice("CRAZZY CALL encerrada.");
    window.setTimeout(() => window.location.assign("/call"), 900);
  };

  const pipCanSwitch = Boolean(
    pip.active &&
    selectedShare &&
    pip.activeKey &&
    selectedShare.key !== pip.activeKey,
  );

  return (
    <section className="crz-call-room">
      <video ref={pip.videoRef} className="crz-call-pip-video" autoPlay playsInline />

      <header className="crz-call-room__header">
        <div>
          <span>CRAZZY CALL</span>
          <strong>{snapshot.room.title || snapshot.room.code}</strong>
          <code>{snapshot.room.code}</code>
        </div>
        <div className="crz-call-room__status">
          <span className="crz-call-discord-chip">🎧 VOZ PELO DISCORD</span>
          <b className={connection === ConnectionState.Connected ? "is-live" : "is-warn"}>
            ● {connection === ConnectionState.Reconnecting ? "RECONECTANDO..." : connection.toUpperCase()}
          </b>
          <span>👁 {snapshot.participants.length}</span>
          {snapshot.room.locked && <span>🔒 BLOQUEADA</span>}
        </div>
      </header>

      {notice && (
        <div className="crz-call-notice">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      {screenAudio && !screenShare && (
        <div className="crz-call-screen-audio-warning">
          🔊 Ao compartilhar o monitor inteiro, o áudio do Discord também pode ser capturado. Para evitar eco, prefira uma aba/aplicativo ou deixe Áudio da tela desligado.
        </div>
      )}

      <div className="crz-call-room__layout">
        <ParticipantList
          participants={snapshot.participants}
          mediaStates={mediaStates}
          currentUserId={user.id}
          canModerate={canModerate}
          isOwner={isOwner || user.role === "admin"}
          busyId={busy}
          onRole={(participant, role) => void updateRole(participant, role)}
          onKick={(participant) => void kick(participant)}
        />

        <main className="crz-call-stage">
          <div className="crz-call-stage__toolbar">
            <div>
              <span>TRANSMISSÃO PRINCIPAL</span>
              <strong>{selectedShare?.participantName || "Nenhuma transmissão"}</strong>
            </div>
            <div>
              {screenEngine.active && screenEngine.settings && (
                <span className="crz-call-local-capture">
                  SUA CAPTURA · {screenEngine.settings.width || "..."}×{screenEngine.settings.height || "..."} · {screenEngine.settings.fps || "..."} FPS
                </span>
              )}
              {selectedShare?.audioTrack && (
                <>
                  <label>
                    Volume
                    <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
                  </label>
                  <button type="button" onClick={() => setMuted((value) => !value)}>{muted ? "🔇" : "🔊"}</button>
                </>
              )}
            </div>
          </div>

          <div ref={playerRef} className="crz-call-stage__player">
            <ScreenSharePlayer share={selectedShare} muted={muted} volume={volume} />
          </div>

          <div className="crz-call-previews">
            {shares.map((share) => (
              <ScreenSharePreview
                key={share.key}
                share={share}
                active={share.key === selectedKey}
                onSelect={() => setSelectedKey(share.key)}
              />
            ))}
            {!shares.length && <span>Nenhuma tela compartilhada ainda.</span>}
          </div>
        </main>

        <ChatPanel
          roomId={snapshot.room.id}
          participants={snapshot.participants}
          currentUserId={user.id}
          collapsed={chatCollapsed}
          onToggle={() => setChatCollapsed((value) => !value)}
        />
      </div>

      <CallControls
        screenShare={screenShare}
        profile={profile}
        screenAudio={screenAudio}
        pipSupported={pip.supported}
        pipActive={pip.active}
        pipCanSwitch={pipCanSwitch}
        hasSelectedShare={Boolean(selectedShare)}
        roomLocked={snapshot.room.locked}
        canPublish={Boolean(canPublish)}
        canModerate={canModerate}
        canEnd={canEnd}
        busy={busy}
        onProfile={setProfile}
        onScreenAudio={() => setScreenAudio((value) => !value)}
        onScreenShare={() => void toggleScreenShare()}
        onPip={() => void togglePip()}
        onPipSwitch={() => void switchPip()}
        onFullscreen={() => void fullscreen()}
        onLock={() => void lockRoom()}
        onLeave={() => void leave()}
        onEnd={() => void end()}
      />
    </section>
  );
}
