"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
  NeonIcon,
  Panel,
} from "@/core/design-system";
import type {
  CommunityAttachment,
  CommunityMessage,
  CommunityProfile,
  CommunitySnapshot,
} from "./types";
import { CommunityVoiceDock } from "./CommunityVoiceDock";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  COMMUNITY_FILE_ACCEPT,
  COMMUNITY_MAX_FILES,
  uploadCommunityFile,
  validateCommunityFile,
} from "./upload";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function MediaView({ attachment }: { attachment: CommunityAttachment }) {
  if (!attachment.url) {
    return (
      <div className="crz-community-media crz-community-media--missing">
        <span>📎</span>
        <small>{attachment.filename}</small>
      </div>
    );
  }

  if (attachment.mimeType.startsWith("image/")) {
    return (
      <a
        className="crz-community-media crz-community-media--image"
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
      >
        <img src={attachment.url} alt={attachment.filename} />
      </a>
    );
  }

  if (attachment.mimeType.startsWith("video/")) {
    return (
      <div className="crz-community-media crz-community-media--video">
        <video src={attachment.url} controls preload="metadata" />
        <small>{attachment.filename}</small>
      </div>
    );
  }

  return (
    <div className="crz-community-media crz-community-media--audio">
      <strong>{attachment.filename}</strong>
      <small>{fileSize(attachment.sizeBytes)}</small>
      <audio src={attachment.url} controls preload="metadata" />
    </div>
  );
}

function ProfileCard({
  profile,
  onClose,
}: {
  profile: CommunityProfile;
  onClose: () => void;
}) {
  return (
    <div className="crz-community-profile-backdrop" onMouseDown={onClose}>
      <Panel
        className="crz-community-profile-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="crz-community-profile-close"
          onClick={onClose}
          aria-label="Fechar perfil"
        >
          ×
        </button>

        <div
          className="crz-community-profile-banner"
          style={{
            background:
              "radial-gradient(circle at 35% 0%, " +
              profile.primaryRole.color +
              "44, transparent 55%), linear-gradient(135deg,#071526,#040912)",
          }}
        />

        <div className="crz-community-profile-main">
          <div
            className="crz-community-profile-avatar"
            style={{ borderColor: profile.primaryRole.color }}
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" />
            ) : (
              <NeonIcon name="verified" size={30} />
            )}
          </div>

          <div className="crz-community-profile-name">
            <strong style={{ color: profile.primaryRole.color }}>{profile.name}</strong>
            <span>{profile.primaryRole.label}</span>
          </div>

          <p>{profile.bio || "Membro da comunidade CRAZZY PROJECT."}</p>

          <div className="crz-community-profile-badges">
            {profile.badges.map((item) => (
              <Badge key={item.id} tone={item.tone}>
                {item.label}
              </Badge>
            ))}
          </div>

          <dl>
            <dt>Discord</dt>
            <dd>
              {profile.discord.guildMember
                ? "Servidor verificado"
                : profile.discord.connected
                  ? "Conectado"
                  : "Não conectado"}
            </dd>

            <dt>Produtos</dt>
            <dd>{profile.stats.activeEntitlements} ativos</dd>
          </dl>

          {profile.discordRoles.length > 0 && (
            <div className="crz-community-profile-roles">
              <small>CARGOS DISCORD</small>
              <div>
                {profile.discordRoles.map((role) => (
                  <span key={role}>{role}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

export function CommunityPage() {
  const [snapshot, setSnapshot] = useState<CommunitySnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [channel, setChannel] = useState("geral");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<CommunityMessage | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<CommunityProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const firstLoadRef = useRef(true);
  const realtimeRefreshRef = useRef<number | null>(null);

  const load = async (silent = false) => {
    if (!silent) {
      setState("loading");
      setError("");
    }

    try {
      const response = await fetch(
        "/api/community?channel=" + encodeURIComponent(channel),
        {
          cache: "no-store",
          credentials: "same-origin",
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível carregar a comunidade.");
      }

      setSnapshot(payload as CommunitySnapshot);
      setState("ready");

      if (firstLoadRef.current) {
        firstLoadRef.current = false;
        window.setTimeout(
          () => bottomRef.current?.scrollIntoView({ behavior: "auto" }),
          50
        );
      }
    } catch (loadError) {
      if (!silent) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Falha ao carregar a comunidade."
        );
        setState("error");
      }
    }
  };

  useEffect(() => {
    firstLoadRef.current = true;
    void load();

    const supabase = createBrowserSupabaseClient();
    const queueRefresh = () => {
      if (realtimeRefreshRef.current) {
        window.clearTimeout(realtimeRefreshRef.current);
      }
      realtimeRefreshRef.current = window.setTimeout(() => {
        realtimeRefreshRef.current = null;
        void load(true);
      }, 120);
    };

    const realtime = supabase
      .channel("community-live-" + channel)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_messages" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_reactions" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_attachments" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_channels" }, queueRefresh)
      .subscribe();

    const fallback = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(true);
      }
    }, 30000);

    return () => {
      if (realtimeRefreshRef.current) {
        window.clearTimeout(realtimeRefreshRef.current);
        realtimeRefreshRef.current = null;
      }
      window.clearInterval(fallback);
      void supabase.removeChannel(realtime);
    };
  }, [channel]);

  const visibleMessages = useMemo(
    () => snapshot?.messages || [],
    [snapshot]
  );

  const chooseFiles = (selected: FileList | null) => {
    setError("");
    if (!selected) return;

    const next = Array.from(selected).slice(0, COMMUNITY_MAX_FILES);
    for (const file of next) {
      const invalid = validateCommunityFile(file);
      if (invalid) {
        setError(invalid);
        return;
      }
    }

    setFiles(next);
  };

  const send = async () => {
    const text = message.trim() || (files.length ? "📎 Mídia enviada." : "");
    if (!text || sending) return;

    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/community/messages", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          message: text,
          reply_to_message_id: reply?.id || null,
        }),
      });

      const sent = await response.json();
      if (!response.ok) {
        throw new Error(sent?.error || "Não foi possível enviar a mensagem.");
      }

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadLabel(
          "Enviando " + (index + 1) + "/" + files.length + " • " + file.name
        );
        await uploadCommunityFile({
          messageId: sent.messageId,
          file,
        });
      }

      setMessage("");
      setReply(null);
      setFiles([]);
      setUploadLabel("");
      if (fileInput.current) fileInput.current.value = "";

      await load(true);
      window.setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        60
      );
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Falha ao enviar."
      );
    } finally {
      setSending(false);
      setUploadLabel("");
    }
  };

  const react = async (messageId: string, emoji: string) => {
    try {
      const response = await fetch("/api/community/reactions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          emoji,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || "Falha na reação.");
      }

      await load(true);
    } catch (reactionError) {
      setError(
        reactionError instanceof Error
          ? reactionError.message
          : "Falha na reação."
      );
    }
  };

  const removeMessage = async (messageId: string) => {
    try {
      const response = await fetch(
        "/api/community/messages/" + messageId + "/delete",
        {
          method: "POST",
          credentials: "same-origin",
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível apagar a mensagem.");
      }

      if (reply?.id === messageId) setReply(null);
      await load(true);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Falha ao apagar mensagem."
      );
    }
  };

  const openProfile = async (userKey: string) => {
    setProfileLoading(true);
    setError("");

    try {
      const response = await fetch("/api/community/profile/" + userKey, {
        cache: "no-store",
        credentials: "same-origin",
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível abrir o perfil.");
      }

      setSelectedProfile(payload.profile as CommunityProfile);
    } catch (profileError) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : "Falha ao abrir perfil."
      );
    } finally {
      setProfileLoading(false);
    }
  };

  if (state === "loading") {
    return (
      <main className="crz-community-page crz-community-state">
        <LoadingState label="Entrando na comunidade CRAZZY PROJECT..." />
      </main>
    );
  }

  if (state === "error" || !snapshot) {
    return (
      <main className="crz-community-page crz-community-state">
        <ErrorState
          title="A comunidade não carregou"
          description={error || "Tente novamente."}
          onRetry={() => void load()}
        />
      </main>
    );
  }

  return (
    <main className="crz-community-page">
      <section className="crz-community-hero">
        <div className="crz-container crz-community-hero__inner">
          <div>
            <small>CRAZZY COMMUNITY</small>
            <h1>Comunidade</h1>
            <p>Converse, compartilhe e participe da comunidade CRAZZY PROJECT.</p>
          </div>

          <div className="crz-community-live">
            <i />
            <strong>{snapshot.activity.recentUsers}</strong>
            <span>ativos nos últimos 15 min</span>
          </div>
        </div>
      </section>

      <div className="crz-container crz-community-layout">
        <aside className="crz-community-channels">
          <Panel className="crz-community-channel-panel">
            <header>
              <small>CANAIS</small>
              <strong>CRAZZY PROJECT</strong>
            </header>

            <nav>
              {snapshot.channels.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  className={channel === item.slug ? "is-active" : ""}
                  onClick={() => setChannel(item.slug)}
                >
                  <span>#</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </div>
                </button>
              ))}
            </nav>
          </Panel>

          <Panel className="crz-community-rules">
            <NeonIcon name="shield" size={25} />
            <div>
              <strong>Comunidade segura</strong>
              <span>Respeite a comunidade e evite compartilhar dados sensíveis no chat.</span>
            </div>
          </Panel>
        </aside>

        <section className="crz-community-chat">
          <Panel className="crz-community-chat-panel">
            <header className="crz-community-chat-head">
              <div>
                <span>#</span>
                <div>
                  <strong>{snapshot.channel.name}</strong>
                  <small>{snapshot.channel.description}</small>
                </div>
              </div>
              <Badge tone="blue">{visibleMessages.length} mensagens</Badge>
            </header>

            <div className="crz-community-message-list custom-scroll">
              {visibleMessages.length === 0 ? (
                <div className="crz-community-empty">
                  <NeonIcon name="community" size={46} />
                  <strong>O chat está zerado</strong>
                  <span>Seja a primeira pessoa a mandar mensagem aqui. 🚀</span>
                </div>
              ) : (
                visibleMessages.map((item) => (
                  <article
                    className={
                      "crz-community-message " +
                      (item.mine ? "is-mine" : "")
                    }
                    key={item.id}
                  >
                    <button
                      type="button"
                      className="crz-community-avatar"
                      onClick={() => void openProfile(item.author.key)}
                      aria-label={"Abrir perfil de " + item.author.name}
                    >
                      {item.author.avatarUrl ? (
                        <img src={item.author.avatarUrl} alt="" />
                      ) : (
                        <NeonIcon name="verified" size={24} />
                      )}
                    </button>

                    <div className="crz-community-message-body">
                      <header>
                        <button
                          type="button"
                          onClick={() => void openProfile(item.author.key)}
                          style={{ color: item.author.primaryRole.color }}
                        >
                          {item.author.name}
                        </button>
                        <span
                          className="crz-community-role"
                          style={{
                            color: item.author.primaryRole.color,
                            borderColor: item.author.primaryRole.color + "66",
                          }}
                        >
                          {item.author.primaryRole.label}
                        </span>
                        {item.author.badges.slice(0, 2).map((badge) => (
                          <Badge key={badge.id} tone={badge.tone}>
                            {badge.label}
                          </Badge>
                        ))}
                        <time>{formatTime(item.createdAt)}</time>
                      </header>

                      {item.reply && (
                        <div className="crz-community-reply-preview">
                          <strong>↪ {item.reply.authorName}</strong>
                          <span>
                            {item.reply.deleted
                              ? "Mensagem removida"
                              : item.reply.body}
                          </span>
                        </div>
                      )}

                      {item.deleted ? (
                        <p className="crz-community-deleted">Mensagem removida.</p>
                      ) : (
                        <p>{item.body}</p>
                      )}

                      {!item.deleted && item.attachments.length > 0 && (
                        <div className="crz-community-media-grid">
                          {item.attachments.map((attachment) => (
                            <MediaView
                              key={attachment.id}
                              attachment={attachment}
                            />
                          ))}
                        </div>
                      )}

                      {!item.deleted && (
                        <div className="crz-community-message-actions">
                          <button type="button" onClick={() => setReply(item)}>
                            ↩ Responder
                          </button>

                          <div className="crz-community-reactions">
                            {item.reactions.map((reaction) => (
                              <button
                                type="button"
                                key={reaction.emoji}
                                className={reaction.reacted ? "is-active" : ""}
                                onClick={() =>
                                  void react(item.id, reaction.emoji)
                                }
                              >
                                {reaction.emoji} {reaction.count}
                              </button>
                            ))}

                            <details>
                              <summary>＋</summary>
                              <div>
                                {snapshot.emoji.map((emoji) => (
                                  <button
                                    type="button"
                                    key={emoji}
                                    onClick={() => void react(item.id, emoji)}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </details>
                          </div>

                          {item.canDelete && (
                            <button
                              type="button"
                              className="is-danger"
                              onClick={() => void removeMessage(item.id)}
                            >
                              Apagar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ))
              )}

              <div ref={bottomRef} />
            </div>

            <div className="crz-community-compose">
              {reply && (
                <div className="crz-community-compose-reply">
                  <span>
                    Respondendo <strong>{reply.author.name}</strong>
                  </span>
                  <button type="button" onClick={() => setReply(null)}>
                    ×
                  </button>
                </div>
              )}

              {files.length > 0 && (
                <div className="crz-community-compose-files">
                  {files.map((file) => (
                    <span key={file.name + file.lastModified}>
                      📎 {file.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="crz-community-compose-row">
                <label
                  className="crz-community-attach"
                  title="Anexar imagem, vídeo ou áudio"
                >
                  ＋
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept={COMMUNITY_FILE_ACCEPT}
                    onChange={(event) => {
                      const selected = event.target.files;
                      setError("");
                      if (!selected) return;

                      const next = Array.from(selected).slice(
                        0,
                        COMMUNITY_MAX_FILES
                      );

                      for (const file of next) {
                        const invalid = validateCommunityFile(file);
                        if (invalid) {
                          setError(invalid);
                          return;
                        }
                      }

                      setFiles(next);
                    }}
                  />
                </label>

                <textarea
                  rows={2}
                  value={message}
                  maxLength={2000}
                  placeholder={
                    reply
                      ? "Responder " + reply.author.name + "..."
                      : "Digite sua mensagem..."
                  }
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />

                <Button
                  disabled={
                    sending || (!message.trim() && files.length === 0)
                  }
                  onClick={() => void send()}
                >
                  {sending ? uploadLabel || "Enviando..." : "Enviar"}
                </Button>
              </div>

              <footer>
                <span>Enter envia • Shift + Enter quebra linha</span>
                <span>{message.length}/2000</span>
              </footer>
            </div>
          </Panel>
        </section>

        <aside className="crz-community-side">
          <CommunityVoiceDock />

          <Panel className="crz-community-info">
            <NeonIcon name="community" size={28} />
            <div>
              <strong>Chat real</strong>
              <span>Mensagens, respostas e reações em um só lugar.</span>
            </div>
          </Panel>

          <Panel className="crz-community-info">
            <NeonIcon name="shield" size={28} />
            <div>
              <strong>Mídia privada</strong>
              <span>Envie imagens, vídeos e áudios direto na conversa.</span>
            </div>
          </Panel>

          <Panel className="crz-community-info">
            <NeonIcon name="verified" size={28} />
            <div>
              <strong>Perfil estilo Discord</strong>
              <span>Clique no avatar ou nick para ver cargos, badges e Discord verificado.</span>
            </div>
          </Panel>
        </aside>
      </div>

      {profileLoading && (
        <div className="crz-community-profile-loading">
          Carregando perfil...
        </div>
      )}

      {selectedProfile && (
        <ProfileCard
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}

      {error && (
        <div className="crz-community-error-toast">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>×</button>
        </div>
      )}
    </main>
  );
}
