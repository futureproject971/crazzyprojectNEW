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
  onJoin: (preferences: CallMediaPreferences, password: string) => void;
}) {
  const [preferences, setPreferences] = useState<CallMediaPreferences>({
    microphone: false,
    camera: false,
  });
  const [password, setPassword] = useState("");
  const isLive = room.room_mode === "live";

  return (
    <section className="crz-call-lobby">
      <div className="crz-call-lobby__brand">
        <img src="/brand/crazzy-logo-hero.png" alt="CRAZZY PROJECT" />
        <span>CRAZZY CALL</span>
      </div>

      <div className="crz-call-lobby__card">
        <span>{isLive ? "TRANSMISSÃO AO VIVO" : "PRONTO PARA ENTRAR"}</span>
        <h1>{room.title || "CRAZZY CALL"}</h1>
        <code>{room.code}</code>

        <div className="crz-call-lobby__profile">
          <div>
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{user.username.slice(0, 2).toUpperCase()}</span>}
          </div>
          <strong>{user.username}</strong>
          <small>{room.participant_count}/{room.max_participants} participantes</small>
        </div>

        {isLive && <div className="crz-call-lobby__warning">Você entra como espectador. Apenas o dono da live e cohosts autorizados podem transmitir; o chat continua liberado.</div>}
        {room.password_protected && (
          <label className="crz-call-lobby__password">
            <span>Esta sala tem senha</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" placeholder="Digite a senha" />
          </label>
        )}
        <div className="crz-call-lobby__toggles">
          <button
            type="button"
            className={preferences.microphone ? "is-on" : ""}
            onClick={() => setPreferences((current) => ({ ...current, microphone: !current.microphone }))}
            disabled={isLive || !room.allow_microphone}
          >
            🎙 Microfone {preferences.microphone ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            className={preferences.camera ? "is-on" : ""}
            onClick={() => setPreferences((current) => ({ ...current, camera: !current.camera }))}
            disabled={isLive || !room.allow_camera}
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
          disabled={busy || (room.locked && room.owner_id !== user.id) || room.status === "ended"}
          onClick={() => onJoin(preferences, password)}
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
