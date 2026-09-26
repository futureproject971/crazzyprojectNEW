"use client";
import { adminConfirm, adminPrompt } from "@/core/ui/adminDialog";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConnectionState,
  RemoteParticipant,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type Participant,
  type RemoteTrackPublication,
} from "livekit-client";
import type { AuthMe } from "@/modules/auth/types";
import { CallControls } from "./CallControls";
import { ChatPanel } from "./ChatPanel";
import { ParticipantList, type ParticipantMediaState } from "./ParticipantList";
import { ScreenSharePlayer, ScreenSharePreview } from "./ScreenSharePlayer";
import { usePictureInPicture } from "./usePictureInPicture";
import type { ActiveScreenShare } from "./media-types";
import type {
  CallMediaPreferences,
  CallParticipant,
  CallParticipantRole,
  CallRoomSnapshot,
} from "./types";

type LiveKitCredentials = {
  token: string;
  url: string;
  roomName: string;
};

function publicationEnabled(participant: Participant, source: Track.Source) {
  const publication = participant.getTrackPublication(source);
  return Boolean(publication && !publication.isMuted);
}

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
        remotePublication:
          participant instanceof RemoteParticipant
            ? (screenPublication as RemoteTrackPublication)
            : undefined,
      });
    }

    return {
      identity: participant.identity,
      microphone: publicationEnabled(participant, Track.Source.Microphone),
      camera: publicationEnabled(participant, Track.Source.Camera),
      screenShare: Boolean(videoTrack && !screenPublication?.isMuted),
    };
  });

  return { shares, mediaStates };
}

function friendlyCallError(code?: string) {
  const value = String(code || "");
  if (value.includes("ROOM_LOCKED")) return "Esta sala está bloqueada pelo host.";
  if (value.includes("ROOM_ENDED")) return "Esta sala já foi encerrada.";
  if (value.includes("PARTICIPANT_KICKED") || value.includes("FORBIDDEN")) return "Você foi removido pelo host.";
  if (value.includes("LIVEKIT_NOT_CONFIGURED")) return "O CRAZZY CALL ainda não está conectado ao servidor LiveKit.";
  return "Não foi possível concluir esta ação.";
}

export function CallRoom({
  initialSnapshot,
  credentials,
  preferences,
  user,
}: {
  initialSnapshot: CallRoomSnapshot;
  credentials: LiveKitCredentials;
  preferences: CallMediaPreferences;
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
  const [quality, setQuality] = useState<"auto" | "720p" | "1080p">("auto");
  const [fps, setFps] = useState<30 | 60>(30);
  const playerRef = useRef<HTMLDivElement>(null);

  const self = snapshot.participants.find((participant) => participant.user_id === user.id);
  const isOwner = snapshot.room.owner_id === user.id;
  const canModerate = isOwner || self?.role === "cohost" || user.role === "admin";
  const canEnd = isOwner || user.role === "admin";
  const canPublish = snapshot.room.room_mode === "call"
    ? self?.role !== "viewer"
    : self?.role === "host" || self?.role === "cohost";

  const selectedShare = useMemo(
    () => shares.find((share) => share.key === selectedKey) || null,
    [selectedKey, shares]
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
      { cache: "no-store" }
    );
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.snapshot) {
      setSnapshot(payload.snapshot as CallRoomSnapshot);
      return true;
    }
    if (response.status === 403) {
      setNotice("Você foi removido pelo host.");
    }
    if (response.status === 409) {
      setNotice("Esta sala foi encerrada.");
    }
    return false;
  }, [snapshot.room.code]);

  const refreshMedia = useCallback((room: Room) => {
    const next = collectMedia(room);
    setShares(next.shares);
    setMediaStates(next.mediaStates);
  }, []);

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
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
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
        await room.connect(credentials.url, credentials.token);
        if (cancelled) return;

        if (preferences.microphone && snapshot.room.allow_microphone) {
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
          } catch {
            setNotice("Não foi possível acessar o microfone.");
          }
        }

        if (preferences.camera && snapshot.room.allow_camera) {
          try {
            await room.localParticipant.setCameraEnabled(true);
          } catch {
            setNotice("Permissão de câmera negada ou câmera indisponível.");
          }
        }

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
    preferences.camera,
    preferences.microphone,
    refreshMedia,
    refreshSnapshot,
    snapshot.room.allow_camera,
    snapshot.room.allow_microphone,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => void refreshSnapshot(), 15000);
    return () => window.clearInterval(timer);
  }, [refreshSnapshot]);

  const localMedia = mediaStates.find((item) => item.identity === user.id);
  const microphone = Boolean(localMedia?.microphone);
  const camera = Boolean(localMedia?.camera);
  const screenShare = Boolean(localMedia?.screenShare);

  const toggleMicrophone = async () => {
    if (!liveRoom || !canPublish || !snapshot.room.allow_microphone) return;
    setBusy("mic");
    setNotice(null);
    try {
      await liveRoom.localParticipant.setMicrophoneEnabled(!microphone);
      refreshMedia(liveRoom);
    } catch {
      setNotice("Não foi possível acessar o microfone.");
    } finally {
      setBusy(null);
    }
  };

  const toggleCamera = async () => {
    if (!liveRoom || !canPublish || !snapshot.room.allow_camera) return;
    setBusy("camera");
    setNotice(null);
    try {
      await liveRoom.localParticipant.setCameraEnabled(!camera);
      refreshMedia(liveRoom);
    } catch {
      setNotice("Permissão de câmera negada ou câmera indisponível.");
    } finally {
      setBusy(null);
    }
  };

  const toggleScreenShare = async () => {
    if (!liveRoom || !canPublish || !snapshot.room.allow_screen_share) return;
    setBusy("screen");
    setNotice(null);
    try {
      await liveRoom.localParticipant.setScreenShareEnabled(!screenShare, {
        audio: true,
        contentHint: "detail",
        systemAudio: "include",
        surfaceSwitching: "include",
      });
      refreshMedia(liveRoom);

      if (!screenShare) {
        window.setTimeout(() => {
          const audio = liveRoom.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
          if (!audio?.audioTrack) {
            setNotice(
              "Seu navegador não enviou áudio da tela. Ao selecionar a tela, habilite Compartilhar áudio quando essa opção estiver disponível."
            );
          }
        }, 700);
      }
    } catch {
      setNotice("Seu navegador não permitiu compartilhar a tela.");
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
        body: JSON.stringify({
          roomId: snapshot.room.id,
          participantId: participant.id,
          role,
        }),
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
    await pip.exit();
    liveRoom?.disconnect();
    setNotice("CRAZZY CALL encerrada.");
    window.setTimeout(() => window.location.assign("/call"), 900);
  };

  const pipCanSwitch = Boolean(
    pip.active &&
    selectedShare &&
    pip.activeKey &&
    selectedShare.key !== pip.activeKey
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
              <label>
                Qualidade
                <select value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)}>
                  <option value="auto">AUTO</option>
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </label>
              <label>
                FPS
                <select value={fps} onChange={(event) => setFps(Number(event.target.value) as 30 | 60)}>
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS</option>
                </select>
              </label>
              <label>
                Volume
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                />
              </label>
              <button type="button" onClick={() => setMuted((value) => !value)}>
                {muted ? "🔇" : "🔊"}
              </button>
            </div>
          </div>

          <div ref={playerRef} className="crz-call-stage__player">
            <ScreenSharePlayer
              share={selectedShare}
              muted={muted}
              volume={volume}
              quality={quality}
              fps={fps}
            />
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
        microphone={microphone}
        camera={camera}
        screenShare={screenShare}
        pipSupported={pip.supported}
        pipActive={pip.active}
        pipCanSwitch={pipCanSwitch}
        hasSelectedShare={Boolean(selectedShare)}
        roomLocked={snapshot.room.locked}
        canPublish={canPublish}
        canModerate={canModerate}
        canEnd={canEnd}
        busy={busy}
        onMicrophone={() => void toggleMicrophone()}
        onCamera={() => void toggleCamera()}
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
