"use client";

import { sendOnEnter } from "@/core/ui/chatKeyboard";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
  NeonIcon,
  Panel,
} from "@/core/design-system";
import type {
  SupportAttachment,
  SupportMessage,
  SupportStatus,
  SupportThread,
} from "./types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  SUPPORT_FILE_ACCEPT,
  SUPPORT_MAX_FILES_PER_MESSAGE,
  uploadSupportFile,
  validateSupportFile,
} from "./upload";

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusMeta(status: SupportStatus) {
  if (status === "waiting_staff") return { label: "AGUARDANDO SUPORTE", tone: "gold" as const };
  if (status === "waiting_user") return { label: "SUA VEZ", tone: "blue" as const };
  if (status === "resolved") return { label: "RESOLVIDO", tone: "green" as const };
  if (status === "closed") return { label: "FECHADO", tone: "neutral" as const };
  return { label: "ABERTO", tone: "blue" as const };
}

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function AttachmentView({ attachment }: { attachment: SupportAttachment }) {
  if (!attachment.url) {
    return (
      <div className="crz-support-attachment crz-support-attachment--missing">
        <span>📎</span>
        <div>
          <strong>{attachment.filename}</strong>
          <small>URL temporária indisponível</small>
        </div>
      </div>
    );
  }

  if (attachment.mimeType.startsWith("image/")) {
    return (
      <a
        className="crz-support-attachment crz-support-attachment--media"
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
      >
        <img src={attachment.url} alt={attachment.filename} />
        <span>{attachment.filename}</span>
      </a>
    );
  }

  if (attachment.mimeType.startsWith("video/")) {
    return (
      <div className="crz-support-attachment crz-support-attachment--player">
        <video controls preload="metadata" src={attachment.url} />
        <span>{attachment.filename}</span>
      </div>
    );
  }

  if (attachment.mimeType.startsWith("audio/")) {
    return (
      <div className="crz-support-attachment crz-support-attachment--audio">
        <strong>{attachment.filename}</strong>
        <audio controls preload="metadata" src={attachment.url} />
      </div>
    );
  }

  return (
    <a
      className="crz-support-attachment"
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
    >
      <span>📄</span>
      <div>
        <strong>{attachment.filename}</strong>
        <small>{fileSize(attachment.sizeBytes)} • link temporário</small>
      </div>
    </a>
  );
}

export function TicketThreadPage({ ticketId }: { ticketId: string }) {
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const realtimeRefreshTimer = useRef<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setState("loading");
      setError("");
    }

    try {
      const response = await fetch("/api/support/" + ticketId, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Não foi possível abrir o ticket.");
      setThread(payload as SupportThread);
      setState("ready");
    } catch (loadError) {
      if (!silent) {
        setError(loadError instanceof Error ? loadError.message : "Falha ao abrir ticket.");
        setState("error");
      }
    }
  }, [ticketId]);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimer.current) {
      window.clearTimeout(realtimeRefreshTimer.current);
    }

    realtimeRefreshTimer.current = window.setTimeout(() => {
      realtimeRefreshTimer.current = null;
      void load(true);
    }, 120);
  }, [load]);

  useEffect(() => {
    void load();

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("support-ticket-" + ticketId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: "ticket_id=eq." + ticketId,
        },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_attachments",
          filter: "ticket_id=eq." + ticketId,
        },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_ticket_events",
          filter: "ticket_id=eq." + ticketId,
        },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_tickets",
          filter: "id=eq." + ticketId,
        },
        scheduleRealtimeRefresh
      )
      .subscribe();

    const fallback = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(true);
      }
    }, 30000);

    return () => {
      if (realtimeRefreshTimer.current) {
        window.clearTimeout(realtimeRefreshTimer.current);
        realtimeRefreshTimer.current = null;
      }
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [ticketId, load, scheduleRealtimeRefresh]);

  useEffect(() => {
    if (!thread?.messages.length) return;
    window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [thread?.messages.length]);

  const attachmentsByMessage = useMemo(() => {
    const map = new Map<string, SupportAttachment[]>();
    for (const attachment of thread?.attachments || []) {
      if (!attachment.messageId) continue;
      const current = map.get(attachment.messageId) || [];
      current.push(attachment);
      map.set(attachment.messageId, current);
    }
    return map;
  }, [thread]);

  const orphanAttachments = useMemo(
    () => (thread?.attachments || []).filter((item) => !item.messageId),
    [thread]
  );

  const chooseFiles = (selected: FileList | null) => {
    setError("");
    if (!selected) return;

    const next = Array.from(selected).slice(0, SUPPORT_MAX_FILES_PER_MESSAGE);
    for (const file of next) {
      const invalid = validateSupportFile(file);
      if (invalid) {
        setError(invalid);
        return;
      }
    }

    setFiles(next);
  };

  const send = async () => {
    if (!thread || sending) return;
    const text = message.trim() || (files.length ? "📎 Anexo enviado." : "");
    if (!text) return;

    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/support/" + ticketId + "/messages", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const sent = await response.json();
      if (!response.ok) throw new Error(sent?.error || "Não foi possível enviar a mensagem.");

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadLabel("Enviando " + (index + 1) + "/" + files.length + " • " + file.name);
        await uploadSupportFile({
          ticketId,
          messageId: sent.messageId,
          file,
        });
      }

      const sentId = String(sent.messageId || ("local-" + Date.now()));
      const knownSender =
        thread.messages.find((item) => item.senderRole === "user")?.sender ||
        { id: null, name: "Você", avatarUrl: null };

      const optimisticMessage: SupportMessage = {
        id: sentId,
        senderRole: "user",
        message: text,
        editedAt: null,
        createdAt: new Date().toISOString(),
        sender: knownSender,
      };

      setThread((current) => {
        if (!current || current.messages.some((item) => item.id === sentId)) return current;
        return {
          ...current,
          messages: [...current.messages, optimisticMessage],
        };
      });

      setMessage("");
      setFiles([]);
      setUploadLabel("");
      if (fileInput.current) fileInput.current.value = "";

      if (files.length > 0) {
        await load(true);
      }

      window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 40);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Falha ao enviar.");
    } finally {
      setSending(false);
      setUploadLabel("");
    }
  };

  const changeStatus = async (action: "close" | "reopen") => {
    setStatusBusy(true);
    setError("");
    try {
      const response = await fetch("/api/support/" + ticketId + "/status", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Não foi possível alterar o ticket.");
      await load(true);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Falha ao alterar ticket.");
    } finally {
      setStatusBusy(false);
    }
  };

  if (state === "loading") {
    return (
      <main className="crz-support-page crz-support-state">
        <LoadingState label="Abrindo conversa de suporte..." />
      </main>
    );
  }

  if (state === "error" || !thread) {
    return (
      <main className="crz-support-page crz-support-state">
        <ErrorState
          title="Ticket indisponível"
          description={error || "Esse ticket não existe ou não pertence à sua conta."}
          onRetry={() => void load()}
        />
      </main>
    );
  }

  const status = statusMeta(thread.ticket.status);
  const context = thread.ticket.context;

  return (
    <main className="crz-support-page">
      <section className="crz-support-thread-head">
        <div className="crz-container crz-support-thread-head__inner">
          <div>
            <a href="/tickets">← Voltar aos tickets</a>
            <small>#{thread.ticket.id.slice(0, 8).toUpperCase()}</small>
            <h1>{thread.ticket.subject}</h1>
          </div>
          <div className="crz-support-thread-head__actions">
            <Badge tone={status.tone}>{status.label}</Badge>
            {thread.ticket.status === "closed" || thread.ticket.status === "resolved" ? (
              <Button
                variant="secondary"
                disabled={statusBusy}
                onClick={() => void changeStatus("reopen")}
              >
                Reabrir
              </Button>
            ) : (
              <Button
                variant="ghost"
                disabled={statusBusy}
                onClick={() => void changeStatus("close")}
              >
                Fechar ticket
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="crz-container crz-support-thread-layout">
        <section className="crz-support-thread">
          <Panel className="crz-support-chat-panel">
            <div className="crz-support-messages">
              {thread.messages.map((item) => {
                const attachments = attachmentsByMessage.get(item.id) || [];
                return (
                  <article
                    key={item.id}
                    className={
                      "crz-support-message " +
                      (item.senderRole === "staff" ? "is-staff" : "is-user")
                    }
                  >
                    <div className="crz-support-message__avatar">
                      {item.sender.avatarUrl ? (
                        <img src={item.sender.avatarUrl} alt="" />
                      ) : (
                        <NeonIcon
                          name={item.senderRole === "staff" ? "shield" : "verified"}
                          size={24}
                        />
                      )}
                    </div>
                    <div className="crz-support-message__bubble">
                      <header>
                        <strong>{item.sender.name}</strong>
                        {item.senderRole === "staff" && <Badge tone="blue">SUPORTE</Badge>}
                        <span>{date(item.createdAt)}</span>
                      </header>
                      <p>{item.message}</p>
                      {attachments.length > 0 && (
                        <div className="crz-support-message__attachments">
                          {attachments.map((attachment) => (
                            <AttachmentView key={attachment.id} attachment={attachment} />
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}

              {orphanAttachments.length > 0 && (
                <div className="crz-support-orphan-files">
                  {orphanAttachments.map((attachment) => (
                    <AttachmentView key={attachment.id} attachment={attachment} />
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {thread.canReply ? (
              <div className="crz-support-compose">
                <textarea
                  value={message}
                  maxLength={4000}
                  rows={4}
                  placeholder="Escreva sua resposta… (Enter envia)"
                  onKeyDown={event => sendOnEnter(event, send)}
                  onChange={(event) => setMessage(event.target.value)}
                />

                {files.length > 0 && (
                  <div className="crz-support-compose-files">
                    {files.map((file) => (
                      <span key={file.name + file.lastModified}>
                        📎 {file.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="crz-support-compose__actions">
                  <label className="crz-button crz-button--secondary crz-button--md">
                    Anexar
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      accept={SUPPORT_FILE_ACCEPT}
                      onChange={(event) => chooseFiles(event.target.files)}
                    />
                  </label>
                  <span>{message.length}/4000</span>
                  <Button
                    disabled={sending || (!message.trim() && files.length === 0)}
                    onClick={() => void send()}
                    leadingIcon={<NeonIcon name="ticket" size={18} />}
                  >
                    {sending ? uploadLabel || "Enviando..." : "Enviar resposta"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="crz-support-closed-notice">
                <NeonIcon name="shield" size={24} />
                <span>Esse ticket está fechado. Reabra para enviar uma nova mensagem.</span>
              </div>
            )}
          </Panel>
        </section>

        <aside className="crz-support-thread-side">
          <Panel className="crz-support-context-card">
            <header>
              <div>
                <small>CONTEXTO</small>
                <h2>Dados relacionados</h2>
              </div>
              <NeonIcon name="cube" size={24} />
            </header>

            {context.product ? (
              <div className="crz-support-context-product">
                {context.product.imageUrl ? (
                  <img src={context.product.imageUrl} alt="" />
                ) : (
                  <div><NeonIcon name="cube" size={28} /></div>
                )}
                <span>
                  <strong>{context.product.name}</strong>
                  <small>{context.plan?.name || context.product.statusLabel}</small>
                </span>
              </div>
            ) : (
              <div className="crz-support-context-empty">Ticket sem produto vinculado.</div>
            )}

            <dl>
              {context.entitlement && (
                <>
                  <dt>Acesso</dt>
                  <dd>{context.entitlement.status}</dd>
                </>
              )}
              {context.order && (
                <>
                  <dt>Pedido</dt>
                  <dd>{context.order.statusLabel}</dd>
                </>
              )}
              {context.library && (
                <>
                  <dt>Library</dt>
                  <dd>{context.library.deliveryType} • {context.library.status}</dd>
                </>
              )}
              <dt>Tutorial</dt>
              <dd>{context.tutorialAvailable ? "Disponível" : "Não associado"}</dd>
            </dl>

            <div className="crz-support-context-safe">
              <NeonIcon name="shield" size={20} />
              <span>Não compartilhe senhas ou informações sensíveis na conversa.</span>
            </div>
          </Panel>

          <Panel className="crz-support-timeline-card">
            <header>
              <div>
                <small>HISTÓRICO</small>
                <h2>Eventos</h2>
              </div>
              <Badge tone="blue">{thread.events.length}</Badge>
            </header>

            <div className="crz-support-event-list">
              {thread.events.slice(-12).reverse().map((event) => (
                <article key={event.id}>
                  <i />
                  <div>
                    <strong>{event.event_type.replaceAll("_", " ")}</strong>
                    <span>
                      {event.from_status && event.to_status
                        ? event.from_status + " → " + event.to_status
                        : date(event.created_at)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </aside>
      </div>

      {error && (
        <div className="crz-support-inline-error">
          <NeonIcon name="shield" size={20} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>×</button>
        </div>
      )}
    </main>
  );
}
