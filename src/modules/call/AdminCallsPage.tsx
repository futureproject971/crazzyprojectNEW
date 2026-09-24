"use client";

import { useCallback, useEffect, useState } from "react";
import { NeonIcon, PageHeader } from "@/core/design-system";

type AdminRoom = {
  id: string;
  code: string;
  title: string | null;
  status: string;
  locked: boolean;
  owner_id: string;
  host_name: string | null;
  participant_count: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export function AdminCallsPage() {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    const response = await fetch("/api/admin/calls", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 403 || response.status === 401) {
      setState("forbidden");
      return;
    }
    if (!response.ok) {
      setState("error");
      return;
    }
    setRooms(payload.rooms || []);
    setState("ready");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const endRoom = async (room: AdminRoom) => {
    if (!window.confirm("Encerrar esta CRAZZY CALL administrativamente?")) return;
    setBusy(room.id);
    try {
      const response = await fetch("/api/call/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id }),
      });
      if (response.ok) await load();
    } finally {
      setBusy(null);
    }
  };

  if (state === "loading") {
    return <main className="crz-call-state"><span className="crz-spinner" /><strong>Carregando salas...</strong></main>;
  }

  if (state === "forbidden") {
    return <main className="crz-call-state"><NeonIcon name="shield" size={42} /><strong>Acesso administrativo necessário.</strong></main>;
  }

  if (state === "error") {
    return <main className="crz-call-state"><strong>Não foi possível carregar CRAZZY CALL.</strong><button type="button" onClick={() => void load()}>Tentar novamente</button></main>;
  }

  return (
    <main className="crz-call-admin">
      <div className="crz-container">
        <PageHeader
          eyebrow="ADMIN • CRAZZY CALL"
          title="Salas e moderação"
          description="Supervisão transparente de metadados das salas. O painel não acessa áudio ou vídeo ocultamente."
          actions={<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <a className="crz-button crz-button--primary crz-button--sm" href="/call">+ Criar / entrar em uma CALL</a>
            <button className="crz-button crz-button--secondary crz-button--sm" type="button" onClick={() => void load()}>↻ Atualizar</button>
          </div>}
        />

        <section className="crz-call-admin__summary">
          <div><small>ATIVAS</small><strong>{rooms.filter((room) => room.status === "live").length}</strong></div>
          <div><small>AGUARDANDO</small><strong>{rooms.filter((room) => room.status === "waiting").length}</strong></div>
          <div><small>FINALIZADAS</small><strong>{rooms.filter((room) => room.status === "ended").length}</strong></div>
          <div><small>PARTICIPANTES AGORA</small><strong>{rooms.reduce((sum, room) => sum + room.participant_count, 0)}</strong></div>
        </section>

        <section className="crz-call-admin__table">
          <header>
            <span>SALA</span><span>HOST</span><span>STATUS</span><span>USUÁRIOS</span><span>CRIADA</span><span>AÇÕES</span>
          </header>
          {rooms.map((room) => (
            <article key={room.id}>
              <span><strong>{room.title || "CRAZZY CALL"}</strong><code>{room.code}</code></span>
              <span>{room.host_name || room.owner_id.slice(0, 8)}</span>
              <span><b className={"is-" + room.status}>{room.status.toUpperCase()}</b>{room.locked && <small>🔒</small>}</span>
              <span>{room.participant_count}</span>
              <span>{new Date(room.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
              <span>
                {room.status !== "ended" && room.status !== "disabled" ? (
                  <button type="button" disabled={busy === room.id} onClick={() => void endRoom(room)}>
                    {busy === room.id ? "ENCERRANDO..." : "ENCERRAR"}
                  </button>
                ) : "—"}
              </span>
            </article>
          ))}
          {!rooms.length && <div className="crz-call-empty-list">Nenhuma sala registrada.</div>}
        </section>
      </div>
    </main>
  );
}
