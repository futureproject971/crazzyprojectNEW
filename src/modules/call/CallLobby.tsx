"use client";

import { useState } from "react";
import type { AuthMe } from "@/modules/auth/types";
import type { CallMediaPreferences, CallRoomPreview } from "./types";

export function CallLobby({
  room,
  user,
  busy,
  error,
  onJoin,
}: {
  room: CallRoomPreview;
  user: AuthMe;
  busy: boolean;
  error: string | null;
  onJoin: (preferences: CallMediaPreferences) => void;
}) {
  const [preferences, setPreferences] = useState<CallMediaPreferences>({
    microphone: false,
    camera: false,
  });

  return (
    <section className="crz-call-lobby">
      <div className="crz-call-lobby__brand">
        <img src="/brand/crazzy-logo-hero.png" alt="CRAZZY PROJECT" />
        <span>CRAZZY CALL</span>
      </div>

      <div className="crz-call-lobby__card">
        <span>PRONTO PARA ENTRAR</span>
        <h1>{room.title || "CRAZZY CALL"}</h1>
        <code>{room.code}</code>

        <div className="crz-call-lobby__profile">
          <div>
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{user.username.slice(0, 2).toUpperCase()}</span>}
          </div>
          <strong>{user.username}</strong>
          <small>{room.participant_count}/{room.max_participants} participantes</small>
        </div>

        <div className="crz-call-lobby__toggles">
          <button
            type="button"
            className={preferences.microphone ? "is-on" : ""}
            onClick={() => setPreferences((current) => ({ ...current, microphone: !current.microphone }))}
            disabled={!room.allow_microphone}
          >
            🎙 Microfone {preferences.microphone ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            className={preferences.camera ? "is-on" : ""}
            onClick={() => setPreferences((current) => ({ ...current, camera: !current.camera }))}
            disabled={!room.allow_camera}
          >
            📷 Câmera {preferences.camera ? "ON" : "OFF"}
          </button>
        </div>

        {room.locked && <div className="crz-call-lobby__warning">Esta sala está bloqueada pelo host.</div>}
        {room.status === "ended" && <div className="crz-call-lobby__warning">Esta sala já foi encerrada.</div>}
        {error && <div className="crz-call-lobby__error">{error}</div>}

        <button
          type="button"
          className="crz-button crz-button--primary crz-button--lg"
          disabled={busy || room.locked || room.status === "ended"}
          onClick={() => onJoin(preferences)}
        >
          {busy ? "ENTRANDO..." : "ENTRAR NA SALA"}
        </button>

        <small className="crz-call-lobby__privacy">
          Microfone e câmera só serão solicitados depois que você entrar com essas opções habilitadas.
        </small>
      </div>
    </section>
  );
}
