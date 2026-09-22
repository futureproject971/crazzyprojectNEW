"use client";

import { useCallback, useEffect, useState } from "react";
import { NeonIcon, PageHeader } from "@/core/design-system";
import { useAuth } from "@/modules/auth/AuthProvider";
import type { CallRoomStatus } from "./types";

type HubRoom = {
  id: string;
  code: string;
  owner_id: string;
  title: string | null;
  status: CallRoomStatus;
  locked: boolean;
  max_participants: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
};

function statusLabel(status: CallRoomStatus) {
  if (status === "live") return "AO VIVO";
  if (status === "waiting") return "AGUARDANDO";
  if (status === "ended") return "ENCERRADA";
  return "DESATIVADA";
}

export function CallHubPage() {
  const { user, loading: authLoading } = useAuth();
  const [rooms, setRooms] = useState<HubRoom[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const response = await fetch("/api/call/list", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setRooms(payload.rooms || []);
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) void load();
  }, [authLoading, load, user]);

  const createRoom = async () => {
    setBusy("create");
    setNotice(null);
    try {
      const response = await fetch("/api/call/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || null, maxParticipants: 20 }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.room?.code) {
        setNotice("A sala não saiu do chão. Tenta de novo.");
        return;
      }
      window.location.assign("/call/" + payload.room.code);
    } finally {
      setBusy(null);
    }
  };

  const copy = async (code: string) => {
    const url = window.location.origin + "/call/" + code;
    await navigator.clipboard?.writeText(url);
    setNotice("Link copiado. Manda pro squad e bora.");
  };

  const endRoom = async (room: HubRoom) => {
    if (!window.confirm("Vai derrubar a CRAZZY CALL pra geral mesmo?")) return;
    setBusy(room.id);
    try {
      const response = await fetch("/api/call/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id }),
      });
      if (response.ok) {
        await load();
        setNotice("Call encerrada. GG.");
      }
    } finally {
      setBusy(null);
    }
  };

  if (authLoading) {
    return <main className="crz-call-state"><span className="crz-spinner" /><strong>Ligando os cabos da CRAZZY CALL...</strong></main>;
  }

  if (!user) {
    return (
      <main className="crz-call-hub">
        <div className="crz-container">
          <PageHeader
            eyebrow="CRAZZY CALL"
            title="Chama o squad e faz barulho."
            description="Abre tua sala, joga o link pro squad e usa voz, vídeo, tela e chat sem sair do corre."
          />
          <section className="crz-call-auth-gate">
            <NeonIcon name="community" size={38} />
            <strong>Entra aí pra abrir ou colar numa sala</strong>
            <p>Mesma conta CRAZZY PROJECT. Zero novela.</p>
            <a className="crz-button crz-button--primary crz-button--md" href="/login?next=%2Fcall">
              Entrar
            </a>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="crz-call-hub">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY CALL"
          title="Chamadas e compartilhamento em tempo real."
          description="Voz, câmera, tela, vários streams, chat, PiP e controle da sala. Tudo no mesmo caos organizado."
        />

        {notice && (
          <div className="crz-call-hub__notice">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)}>×</button>
          </div>
        )}

        <section className="crz-call-create">
          <div>
            <NeonIcon name="community" size={32} />
            <span>
              <small>NOVA SALA</small>
              <strong>CRIAR CRAZZY CALL</strong>
              <em>Link limpo, sem token nem segredo passeando pela URL.</em>
            </span>
          </div>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 80))}
            placeholder="Dá um nome pro caos (opcional)"
            maxLength={80}
          />
          <button
            type="button"
            className="crz-button crz-button--primary crz-button--md"
            disabled={busy === "create"}
            onClick={() => void createRoom()}
          >
            {busy === "create" ? "MONTANDO..." : "+ ABRIR NOVA SALA"}
          </button>
        </section>

        <section className="crz-call-my-rooms">
          <header>
            <div><small>MINHAS SALAS</small><h2>Teus corres recentes</h2></div>
            <button type="button" onClick={() => void load()}>↻ Puxar de novo</button>
          </header>

          {!rooms.length ? (
            <div className="crz-call-empty-list">
              <NeonIcon name="community" size={30} />
              <strong>Nenhuma call por aqui ainda</strong>
              <span>Abre a primeira aí em cima e chama o squad.</span>
            </div>
          ) : (
            <div className="crz-call-room-cards">
              {rooms.map((room) => (
                <article key={room.id}>
                  <div className="crz-call-room-card__status">
                    <b className={"is-" + room.status}>{statusLabel(room.status)}</b>
                    {room.locked && <span>🔒</span>}
                  </div>
                  <strong>{room.title || "CRAZZY CALL"}</strong>
                  <code>{room.code}</code>
                  <small>
                    {new Date(room.created_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </small>
                  <div>
                    {room.status !== "ended" && room.status !== "disabled" && (
                      <a className="crz-button crz-button--primary crz-button--sm" href={"/call/" + room.code}>
                        ENTRAR
                      </a>
                    )}
                    <button type="button" onClick={() => void copy(room.code)}>
                      COPIAR E CHAMAR
                    </button>
                    {room.owner_id === user.id && room.status !== "ended" && (
                      <button
                        type="button"
                        className="is-danger"
                        disabled={busy === room.id}
                        onClick={() => void endRoom(room)}
                      >
                        {busy === room.id ? "DERRUBANDO..." : "ENCERRAR CALL"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
