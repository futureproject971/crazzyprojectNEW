"use client";

export function CallControls({
  microphone,
  camera,
  screenShare,
  pipSupported,
  pipActive,
  pipCanSwitch,
  hasSelectedShare,
  roomLocked,
  canPublish,
  canModerate,
  canEnd,
  busy,
  onMicrophone,
  onCamera,
  onScreenShare,
  onPip,
  onPipSwitch,
  onFullscreen,
  onLock,
  onLeave,
  onEnd,
}: {
  microphone: boolean;
  camera: boolean;
  screenShare: boolean;
  pipSupported: boolean;
  pipActive: boolean;
  pipCanSwitch: boolean;
  hasSelectedShare: boolean;
  roomLocked: boolean;
  canPublish: boolean;
  canModerate: boolean;
  canEnd: boolean;
  busy: string | null;
  onMicrophone: () => void;
  onCamera: () => void;
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
      <button type="button" className={microphone ? "is-on" : "is-off"} disabled={!canPublish || busy === "mic"} onClick={onMicrophone} title={!canPublish ? "Você está assistindo esta live." : undefined}>
        <span>🎙</span>{microphone ? "MIC ON" : "MIC OFF"}
      </button>

      <button type="button" className={camera ? "is-on" : "is-off"} disabled={!canPublish || busy === "camera"} onClick={onCamera} title={!canPublish ? "Você está assistindo esta live." : undefined}>
        <span>📷</span>{camera ? "CÂMERA ON" : "CÂMERA OFF"}
      </button>

      <button type="button" className={screenShare ? "is-on" : ""} disabled={!canPublish || busy === "screen"} onClick={onScreenShare} title={!canPublish ? "Você está assistindo esta live." : undefined}>
        <span>🖥</span>{screenShare ? "PARAR TELA" : "COMPARTILHAR TELA"}
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
