"use client";

import { SCREEN_PROFILES, type ScreenShareProfile } from "./screen-share/profiles";

export function CallControls({
  screenShare,
  profile,
  screenAudio,
  pipSupported,
  pipActive,
  pipCanSwitch,
  hasSelectedShare,
  roomLocked,
  canPublish,
  canModerate,
  canEnd,
  busy,
  onProfile,
  onScreenAudio,
  onScreenShare,
  onPip,
  onPipSwitch,
  onFullscreen,
  onLock,
  onLeave,
  onEnd,
}: {
  screenShare: boolean;
  profile: ScreenShareProfile;
  screenAudio: boolean;
  pipSupported: boolean;
  pipActive: boolean;
  pipCanSwitch: boolean;
  hasSelectedShare: boolean;
  roomLocked: boolean;
  canPublish: boolean;
  canModerate: boolean;
  canEnd: boolean;
  busy: string | null;
  onProfile: (profile: ScreenShareProfile) => void;
  onScreenAudio: () => void;
  onScreenShare: () => void;
  onPip: () => void;
  onPipSwitch: () => void;
  onFullscreen: () => void;
  onLock: () => void;
  onLeave: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="crz-call-controls">
      <span className="crz-call-discord-audio">🎧 VOZ PELO DISCORD</span>

      <div className="crz-call-profile-switcher" aria-label="Perfil da transmissão">
        {(Object.keys(SCREEN_PROFILES) as ScreenShareProfile[]).map((id) => (
          <button
            type="button"
            key={id}
            className={profile === id ? "is-on" : ""}
            disabled={!canPublish || screenShare || busy === "screen"}
            onClick={() => onProfile(id)}
            title={screenShare ? "Pare a transmissão para trocar o perfil." : SCREEN_PROFILES[id].description}
          >
            {SCREEN_PROFILES[id].label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={screenAudio ? "is-on" : ""}
        disabled={!canPublish || screenShare || busy === "screen"}
        onClick={onScreenAudio}
        title={screenShare ? "Pare a transmissão para alterar o áudio da tela." : undefined}
      >
        <span>🔊</span>ÁUDIO DA TELA {screenAudio ? "ON" : "OFF"}
      </button>

      <button type="button" className={screenShare ? "is-on" : ""} disabled={!canPublish || busy === "screen"} onClick={onScreenShare} title={!canPublish ? "Você está assistindo esta transmissão." : undefined}>
        <span>🖥</span>{screenShare ? "PARAR TRANSMISSÃO" : "COMPARTILHAR TELA"}
      </button>

      <button
        type="button"
        disabled={!pipSupported || !hasSelectedShare || busy === "pip"}
        onClick={onPip}
        title={!pipSupported ? "Picture-in-Picture não está disponível neste navegador." : undefined}
      >
        <span>▣</span>{pipActive ? "SAIR DO PiP" : "PICTURE-IN-PICTURE"}
      </button>

      {pipCanSwitch && (
        <button type="button" className="is-accent" disabled={busy === "pip"} onClick={onPipSwitch}>
          TROCAR TRANSMISSÃO NO PiP
        </button>
      )}

      <button type="button" disabled={!hasSelectedShare} onClick={onFullscreen}>
        <span>⛶</span>TELA CHEIA
      </button>

      {canModerate && (
        <button type="button" disabled={busy === "lock"} onClick={onLock}>
          <span>{roomLocked ? "🔓" : "🔒"}</span>{roomLocked ? "DESBLOQUEAR" : "TRANCAR SALA"}
        </button>
      )}

      <button type="button" className="is-danger" disabled={busy === "leave"} onClick={onLeave}>
        <span>☎</span>SAIR
      </button>

      {canEnd && (
        <button type="button" className="is-danger is-strong" disabled={busy === "end"} onClick={onEnd}>
          ENCERRAR SALA
        </button>
      )}
    </div>
  );
}
