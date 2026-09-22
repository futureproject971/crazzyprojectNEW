"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  NeonIcon,
  Panel,
} from "@/core/design-system";
import type {
  LibraryDelivery,
  LibraryDeliveryStatus,
  LibraryDeliveryType,
  LibraryRevealResponse,
  LibrarySnapshot,
} from "./types";

type LibraryTab = "all" | "key" | "account" | "link" | "reward" | "history";

const tabs: Array<{ id: LibraryTab; label: string }> = [
  { id: "all", label: "Tudo" },
  { id: "key", label: "Minhas Keys" },
  { id: "account", label: "Minhas contas" },
  { id: "link", label: "Links e downloads" },
  { id: "reward", label: "Trials e drops" },
  { id: "history", label: "Histórico" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: LibraryDeliveryStatus) {
  const labels: Record<LibraryDeliveryStatus, string> = {
    available: "DISPONÍVEL",
    expired: "EXPIRADO",
    revoked: "REVOGADO",
    refunded: "REEMBOLSADO",
    disputed: "EM DISPUTA",
  };
  return labels[status];
}

function statusTone(status: LibraryDeliveryStatus) {
  if (status === "available") return "green" as const;
  if (status === "expired") return "neutral" as const;
  return "pink" as const;
}

function typeLabel(type: LibraryDeliveryType) {
  if (type === "key") return "KEY";
  if (type === "account") return "CONTA";
  if (type === "link") return "LINK";
  if (type === "reward") return "RECOMPENSA";
  return "ENTREGA";
}

function typeIcon(type: LibraryDeliveryType) {
  if (type === "account") return "community" as const;
  if (type === "reward") return "crown" as const;
  if (type === "link") return "book" as const;
  return "cube" as const;
}

function maskedValue(type: LibraryDeliveryType) {
  if (type === "account") return "••••••••••••••••••••";
  if (type === "link") return "https://••••••••••••••";
  return "••••••-••••••-••••••";
}

function roleStatus(delivery: LibraryDelivery) {
  if (!delivery.discordRoles.length) return null;
  const granted = delivery.discordRoles.find((role) => role.status === "granted");
  return granted || delivery.discordRoles[0];
}

export function LibraryPage() {
  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<LibraryTab>("all");
  const [revealed, setRevealed] = useState<LibraryRevealResponse | null>(null);
  const [revealBusy, setRevealBusy] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const load = async () => {
    setState("loading");
    setError("");
    setRevealed(null);
    try {
      const response = await fetch("/api/library", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Tua Library não abriu agora.");
      setSnapshot(payload as LibrarySnapshot);
      setState("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "A Library deu uma engasgada.");
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!snapshot || tab === "history") return [];
    if (tab === "all") return snapshot.deliveries;
    return snapshot.deliveries.filter((item) => item.deliveryType === tab);
  }, [snapshot, tab]);

  const changeTab = (next: LibraryTab) => {
    setTab(next);
    setRevealed(null);
    setCopyStatus(null);
  };

  const reveal = async (deliveryId: string) => {
    setRevealBusy(deliveryId);
    setCopyStatus(null);
    setRevealed(null);

    try {
      const response = await fetch("/api/library/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ delivery_id: deliveryId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error === "DELIVERY_NOT_AVAILABLE"
            ? "Essa entrega não tá pronta pra revelar."
            : payload?.error || "Não deu pra revelar isso agora."
        );
      }

      setRevealed(payload as LibraryRevealResponse);
      setSnapshot((current) => {
        if (!current) return current;
        return {
          ...current,
          deliveries: current.deliveries.map((item) =>
            item.id === deliveryId
              ? {
                  ...item,
                  revealCount: item.revealCount + 1,
                  lastRevealedAt: new Date().toISOString(),
                }
              : item
          ),
        };
      });
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : "A revelação tropeçou.");
    } finally {
      setRevealBusy(null);
    }
  };

  const copy = async (deliveryId: string) => {
    if (!revealed || revealed.deliveryId !== deliveryId) return;

    try {
      await navigator.clipboard.writeText(revealed.payload);
      setCopyStatus(deliveryId);

      await fetch("/api/library/copy-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ delivery_id: deliveryId }),
      }).catch(() => null);

      window.setTimeout(() => {
        setCopyStatus((current) => (current === deliveryId ? null : current));
      }, 1800);
    } catch {
      setCopyStatus("copy-error:" + deliveryId);
    }
  };

  if (state === "loading") {
    return (
      <main className="crz-library-page crz-library-state">
        <LoadingState label="Abrindo tua bag segura..." />
      </main>
    );
  }

  if (state === "error" || !snapshot) {
    return (
      <main className="crz-library-page crz-library-state">
        <ErrorState
          title="Tua bag não entrou no mapa"
          description={error || "Tenta mais uma."}
          onRetry={() => void load()}
        />
      </main>
    );
  }

  return (
    <main className="crz-library-page">
      <section className="crz-library-hero">
        <div className="crz-container crz-library-hero__inner">
          <div>
            <small>M11 • CRAZZY LIBRARY</small>
            <h1>Tua bag. Teu controle.</h1>
            <p>
              Keys, contas e links ficam mascarados até você pedir a revelação segura.
            </p>
          </div>

          <div className="crz-library-hero__stats">
            <span><strong>{snapshot.stats.total}</strong> entregas</span>
            <span><strong>{snapshot.stats.available}</strong> disponíveis</span>
            <span><strong>{snapshot.history.length}</strong> eventos</span>
          </div>
        </div>
      </section>

      <div className="crz-container crz-library-shell">
        <nav className="crz-library-tabs" aria-label="Separa por tipo">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "is-active" : ""}
              onClick={() => changeTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="crz-library-security">
          <NeonIcon name="shield" size={24} />
          <div>
            <strong>Reveal no modo seguro</strong>
            <span>
              O conteúdo não fica em localStorage, URL ou snapshot. Ao ocultar ou trocar de aba,
              o plaintext sai da interface.
            </span>
          </div>
        </div>

        {tab === "history" ? (
          <Panel className="crz-library-panel">
            <header>
              <div>
                <small>AUDITORIA</small>
                <h2>Tudo que tu revelou ou copiou</h2>
              </div>
              <Badge tone="blue">{snapshot.history.length}</Badge>
            </header>

            {!snapshot.history.length ? (
              <EmptyState
                icon={<NeonIcon name="shield" size={38} />}
                title="Nada revelado ainda"
                description="Revelou ou copiou? O evento fica no histórico, mas o segredo não fica dando sopa."
              />
            ) : (
              <div className="crz-library-history">
                {snapshot.history.map((event) => (
                  <article key={event.id}>
                    <NeonIcon name={event.action === "copy" ? "verified" : "shield"} size={22} />
                    <div>
                      <strong>{event.productName}</strong>
                      <span>{event.action === "copy" ? "Copiado. GG." : "Reveal feito"} • {typeLabel(event.deliveryType)}</span>
                    </div>
                    <small>{formatDate(event.createdAt)}</small>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        ) : !filtered.length ? (
          <div className="crz-library-empty">
            <EmptyState
              icon={<NeonIcon name="cube" size={42} />}
              title="Essa prateleira tá vazia"
              description="Entregou no servidor, cai aqui sozinho."
              action={<a className="crz-button crz-button--primary crz-button--md" href="/produtos">VER O ARSENAL</a>}
            />
          </div>
        ) : (
          <section className="crz-library-grid">
            {filtered.map((delivery) => {
              const isRevealed = revealed?.deliveryId === delivery.id;
              const role = roleStatus(delivery);
              const accountName =
                typeof delivery.metadata.account_name === "string"
                  ? delivery.metadata.account_name
                  : null;

              return (
                <article className="crz-library-card" key={delivery.id}>
                  <div className="crz-library-card__art">
                    {delivery.product.imageUrl ? (
                      <img src={delivery.product.imageUrl} alt="" />
                    ) : (
                      <NeonIcon name={typeIcon(delivery.deliveryType)} size={46} />
                    )}
                    <span>{typeLabel(delivery.deliveryType)}</span>
                  </div>

                  <div className="crz-library-card__body">
                    <div className="crz-library-card__headline">
                      <div>
                        <small>{delivery.plan.name || delivery.plan.code || "DROP DIGITAL"}</small>
                        <strong>{accountName || delivery.product.name}</strong>
                        <span>{delivery.product.statusLabel || "Entrega no histórico"}</span>
                      </div>
                      <Badge tone={statusTone(delivery.status)}>
                        {statusLabel(delivery.status)}
                      </Badge>
                    </div>

                    <div className={"crz-library-secret " + (isRevealed ? "is-revealed" : "")}>
                      <div className="crz-library-secret__label">
                        <span>
                          {delivery.deliveryType === "account"
                            ? "Credenciais"
                            : delivery.deliveryType === "link"
                              ? "Link no modo fechado"
                              : "O que caiu pra ti"}
                        </span>
                        {isRevealed && <b>ABERTO POR TEMPO CURTO</b>}
                      </div>
                      <pre>{isRevealed ? revealed.payload : maskedValue(delivery.deliveryType)}</pre>
                    </div>

                    <div className="crz-library-card__actions">
                      {!isRevealed ? (
                        <Button
                          variant="secondary"
                          disabled={!delivery.canReveal || revealBusy === delivery.id}
                          onClick={() => void reveal(delivery.id)}
                          leadingIcon={<NeonIcon name="shield" size={18} />}
                        >
                          {revealBusy === delivery.id
                            ? "ABRINDO..."
                            : delivery.canReveal
                              ? "Revelar"
                              : "FORA DO ROUND"}
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={() => void copy(delivery.id)}
                            leadingIcon={<NeonIcon name="verified" size={18} />}
                          >
                            {copyStatus === delivery.id
                              ? "COPIADO ✓"
                              : copyStatus === "copy-error:" + delivery.id
                                ? "Falhou"
                                : "Copiar"}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setRevealed(null);
                              setCopyStatus(null);
                            }}
                          >
                            Ocultar
                          </Button>
                        </>
                      )}
                    </div>

                    <div className="crz-library-card__meta">
                      <span>Entregue: <strong>{formatDate(delivery.deliveredAt)}</strong></span>
                      <span>
                        Expiração: <strong>{delivery.expiresAt ? formatDate(delivery.expiresAt) : "Sem relógio correndo"}</strong>
                      </span>
                      <span>Revelações: <strong>{delivery.revealCount}</strong></span>
                      <span>Última: <strong>{formatDate(delivery.lastRevealedAt)}</strong></span>
                    </div>

                    <footer>
                      {delivery.tutorialAvailable ? (
                        <span className="is-info">📖 Tutorial liberado • viewer no M22</span>
                      ) : (
                        <span>Sem tutorial grudado nisso</span>
                      )}
                      {role ? (
                        <span className={role.status === "granted" ? "is-ok" : ""}>
                          Discord: {role.role_name || "Cargo"} • {role.status}
                        </span>
                      ) : (
                        <span>Sem cargo Discord ligado nisso</span>
                      )}
                    </footer>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {error && state === "ready" && (
          <div className="crz-library-inline-error">
            <NeonIcon name="shield" size={20} />
            <span>{error}</span>
            <button type="button" onClick={() => setError("")}>×</button>
          </div>
        )}
      </div>
    </main>
  );
}
