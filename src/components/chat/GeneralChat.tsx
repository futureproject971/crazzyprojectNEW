"use client";

import { sendOnEnter } from "@/core/ui/chatKeyboard";

import { useCallback, useEffect, useRef, useState } from "react";
import { NeonSectionIcon } from "@/components/ui/NeonSectionIcon";
import { useAuth } from "@/modules/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type PreviewMessage = {
  id: string;
  body: string | null;
  createdAt: string;
  author: {
    name: string;
    avatarUrl: string | null;
  };
};

type PreviewSnapshot = {
  channel: {
    slug: string;
    name: string;
    description: string | null;
  };
  messages: PreviewMessage[];
  activity: {
    recentUsers: number;
  };
};

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Avatar({ message, index }: { message: PreviewMessage; index: number }) {
  if (message.author.avatarUrl) {
    return (
      <span className="chat-avatar chat-avatar--live" aria-hidden="true">
        <img src={message.author.avatarUrl} alt="" />
      </span>
    );
  }

  const tone = ["blue", "pink", "orange", "cyan", "violet"][index % 5];
  return (
    <span className={"chat-avatar chat-avatar--" + tone} aria-hidden="true">
      {String(index + 1).padStart(2, "0")}
    </span>
  );
}

export function GeneralChat() {
  const { user, loading: authLoading, signIn } = useAuth();
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/community/preview?channel=geral&limit=8", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) throw new Error();
      setSnapshot(payload as PreviewSnapshot);
      setError("");
    } catch {
      setError("Chat indisponível agora.");
    }
  }, []);

  const queueLoad = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void load();
    }, 120);
  }, [load]);

  useEffect(() => {
    void load();

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("home-community-preview")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_messages" },
        queueLoad
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_channels" },
        queueLoad
      )
      .subscribe();

    const fallback = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10000);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [load, queueLoad]);

  useEffect(() => {
    if (!snapshot?.messages.length) return;
    window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [snapshot?.messages.length]);

  const send = async () => {
    if (authLoading || sending) return;

    if (!user) {
      await signIn("discord", "/");
      return;
    }

    const text = message.trim();
    if (!text) return;

    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/community/messages", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "geral",
          message: text,
          reply_to_message_id: null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao enviar.");
      }

      setMessage("");
      await load();
    } catch {
      setError("Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  };

  const messages = snapshot?.messages || [];
  const online = Number(snapshot?.activity?.recentUsers || 0);

  return (
    <section className="social-panel chat-panel" id="comunidade" aria-labelledby="chat-title">
      <header className="panel-heading chat-heading">
        <div className="panel-heading-main">
          <NeonSectionIcon src="/icons/neon-v2/chat.svg" />
          <div>
            <h2 id="chat-title">{snapshot?.channel?.name || "Chat Geral"}</h2>
            <p>{snapshot?.channel?.description || "Converse com a comunidade CRAZZY PROJECT."}</p>
          </div>
        </div>
        <span className="online-counter"><i /> {online} ativo{online === 1 ? "" : "s"}</span>
      </header>

      <div className="chat-list custom-scroll">
        {messages.length ? (
          messages.map((item, index) => (
            <article className="chat-row" key={item.id}>
              <Avatar message={item} index={index} />
              <div className="chat-bubble">
                <div className="chat-meta">
                  <strong>{item.author.name}</strong>
                  <span>{timeLabel(item.createdAt)}</span>
                </div>
                <p>{item.body}</p>
              </div>
            </article>
          ))
        ) : (
          <div className="chat-live-empty">
            <strong>Chat Geral</strong>
            <span>Seja a primeira pessoa a mandar mensagem.</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-compose">
        <div className="chat-input-shell chat-live-input-shell">
          <span className="compose-mini" aria-hidden="true">⊙</span>
          <textarea rows={2}
            className="chat-live-input"
            value={message}
            maxLength={2000}
            disabled={sending}
            placeholder={user ? "Escreva no Chat Geral..." : "Entre com Discord para conversar..."}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={event => sendOnEnter(event, send)}
          />
          <a className="compose-mini" href="/comunidade" aria-label="Abrir comunidade completa">↗</a>
        </div>
        <button
          type="button"
          className="send-button chat-preview-send"
          disabled={sending}
          onClick={() => void send()}
          aria-label={user ? "Enviar mensagem" : "Entrar para conversar"}
        >
          <span
            className="send-icon"
            style={{ WebkitMaskImage: 'url("/icons/send.svg")', maskImage: 'url("/icons/send.svg")' }}
          />
        </button>
      </div>

      {error && <div className="chat-live-error">{error}</div>}

      <div className="chat-reactions">
        {["🔥","💙","👍","😂","🎮","👀","💯"].map((emoji) => (
          <button
            type="button"
            key={emoji}
            onClick={() => setMessage((current) => (current + " " + emoji).trimStart())}
            aria-label={"Adicionar " + emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </section>
  );
}
