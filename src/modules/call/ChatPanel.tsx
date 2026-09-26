"use client";

import { sendOnEnter } from "@/core/ui/chatKeyboard";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { CallMessage, CallParticipant } from "./types";

function mergeMessages(current: CallMessage[], incoming: CallMessage) {
  if (current.some((item) => item.id === incoming.id)) return current;
  return [...current, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function ChatPanel({
  roomId,
  participants,
  currentUserId,
  collapsed,
  onToggle,
}: {
  roomId: string;
  participants: CallParticipant[];
  currentUserId: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const names = useMemo(
    () => new Map(participants.map((participant) => [participant.user_id, participant.display_name])),
    [participants]
  );

  const load = useCallback(async () => {
    const response = await fetch("/api/call/messages?roomId=" + encodeURIComponent(roomId), {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setMessages(payload.messages || []);
  }, [roomId]);

  useEffect(() => {
    void load();
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("call-messages:" + roomId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_messages",
          filter: "room_id=eq." + roomId,
        },
        (payload: any) => {
          const next = payload.new as CallMessage;
          setMessages((current) => mergeMessages(current, next));
          if (collapsed && next.user_id !== currentUserId) {
            setUnread((value) => value + 1);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [collapsed, currentUserId, load, roomId]);

  useEffect(() => {
    if (!collapsed) {
      setUnread(0);
      window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
    }
  }, [collapsed, messages.length]);

  const [sendError, setSendError] = useState("");
  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setSendError("");
    try {
      const response = await fetch("/api/call/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, message }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.message) throw new Error("Não foi possível enviar. Tente novamente.");
      if (response.ok && payload.message) {
        setMessages((current) => mergeMessages(current, payload.message as CallMessage));
        setDraft("");
      }
    } catch { setSendError("Não foi possível enviar. Sua mensagem foi mantida para tentar novamente."); } finally {
      setSending(false);
    }
  };

  return (
    <aside className={"crz-call-chat " + (collapsed ? "is-collapsed" : "")}>
      <button type="button" className="crz-call-chat__toggle" onClick={onToggle}>
        CHAT {unread > 0 && <b>{unread}</b>}
      </button>

      {!collapsed && (
        <>
          <header>
            <span>CHAT DA SALA</span>
            <small>Mensagens em tempo real</small>
          </header>

          <div className="crz-call-chat__messages">
            {messages.map((message) => (
              <article key={message.id} className={message.user_id === currentUserId ? "is-self" : ""}>
                <div>
                  <strong>{names.get(message.user_id) || "Participante"}</strong>
                  <time>
                    {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p>{message.message}</p>
              </article>
            ))}
            {!messages.length && <div className="crz-call-chat__empty">Nenhuma mensagem ainda.</div>}
            <div ref={endRef} />
          </div>

          {sendError && <p role="alert" className="crz-call-chat__error">{sendError}</p>}
          <form
            className="crz-call-chat__composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <textarea rows={2} onKeyDown={event => sendOnEnter(event, send)}
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, 2000))}
              placeholder="Escreva uma mensagem..."
              maxLength={2000}
            />
            <button type="submit" disabled={!draft.trim() || sending}>
              {sending ? "..." : "Enviar"}
            </button>
          </form>
        </>
      )}
    </aside>
  );
}
