"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/core/design-system";

type VoiceRoom = {
  id: string;
  code: string;
  title: string | null;
  status: "waiting" | "live" | "ended" | "disabled";
  locked: boolean;
  max_participants: number;
  created_at: string;
};

export function CommunityVoiceDock() {
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/call/list", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setRooms((payload.rooms || []).slice(0, 5));
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 12000);
    return () => window.clearInterval(timer);
  }, [load]);

  const createRoom = async () => {
    if (busy) return;
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/call/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Sala da Comunidade",
          maxParticipants: 20,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.room?.code) {
        throw new Error("CREATE_FAILED");
      }
      window.location.assign("/call/" + payload.room.code);
    } catch {
      setNotice("Não foi possível criar a sala.");
      setBusy(false);
    }
  };

  const joinByCode = () => {
    const next = code.trim().toUpperCase();
    if (!next) return;
    window.location.assign("/call/" + encodeURIComponent(next));
  };

  return (
    <Panel className="crz-community-voice-dock">
      <header>
        <div>
          <small>VOZ • VÍDEO • TELA</small>
          <strong>CRAZZY CALL</strong>
        </div>
        <span className="crz-community-voice-dock__live">● AO VIVO</span>
      </header>

      <div className="crz-community-voice-actions">
        <button type="button" onClick={() => void createRoom()} disabled={busy}>
          <span>＋</span>
          <div>
            <strong>{busy ? "Criando..." : "Criar sala"}</strong>
            <small>Voz, câmera e screen share</small>
          </div>
        </button>

        <label>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.slice(0, 24))}
            onKeyDown={(event) => {
              if (event.key === "Enter") joinByCode();
            }}
            placeholder="Código da sala"
          />
          <button type="button" onClick={joinByCode}>Entrar</button>
        </label>
      </div>

      <div className="crz-community-voice-list">
        <div className="crz-community-voice-list__label">
          <span>SUAS SALAS</span>
          <a href="/call">Ver todas</a>
        </div>

        {rooms.length === 0 ? (
          <div className="crz-community-voice-empty">
            <span>🎙</span>
            <small>Nenhuma sala recente.</small>
          </div>
        ) : (
          rooms.map((room) => (
            <a
              key={room.id}
              href={"/call/" + room.code}
              className={"crz-community-voice-room is-" + room.status}
            >
              <span className="crz-community-voice-room__icon">🔊</span>
              <div>
                <strong>{room.title || "CRAZZY CALL"}</strong>
                <small>
                  {room.status === "live"
                    ? "Sala ativa"
                    : room.status === "waiting"
                      ? "Aguardando"
                      : room.status === "ended"
                        ? "Encerrada"
                        : "Indisponível"}
                  {room.locked ? " • 🔒" : ""}
                </small>
              </div>
              <b>›</b>
            </a>
          ))
        )}
      </div>

      <div className="crz-community-voice-features">
        <span>🎙 MIC</span>
        <span>📷 CAM</span>
        <span>🖥 TELA</span>
        <span>▣ PiP</span>
      </div>

      {notice && <p>{notice}</p>}
    </Panel>
  );
}
