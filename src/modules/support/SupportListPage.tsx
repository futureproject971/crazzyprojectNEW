"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  NeonIcon,
  Panel,
} from "@/core/design-system";
import type {
  SupportCategory,
  SupportSnapshot,
  SupportStatus,
} from "./types";

const categoryLabels: Record<SupportCategory, string> = {
  product: "Produto",
  payment: "Pagamento",
  delivery: "Entrega",
  technical: "Técnico",
  account: "Conta",
  other: "Outro",
};

function statusMeta(status: SupportStatus) {
  if (status === "waiting_staff") return { label: "AGUARDANDO SUPORTE", tone: "gold" as const };
  if (status === "waiting_user") return { label: "SUA VEZ", tone: "blue" as const };
  if (status === "resolved") return { label: "RESOLVIDO", tone: "green" as const };
  if (status === "closed") return { label: "FECHADO", tone: "neutral" as const };
  return { label: "ABERTO", tone: "blue" as const };
}

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SupportListPage() {
  const [snapshot, setSnapshot] = useState<SupportSnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = async () => {
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/support", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar seus tickets.");
      setSnapshot(payload as SupportSnapshot);
      setState("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar tickets.");
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (state === "loading") {
    return (
      <main className="crz-support-page crz-support-state">
        <LoadingState label="Carregando seus tickets..." />
      </main>
    );
  }

  if (state === "error" || !snapshot) {
    return (
      <main className="crz-support-page crz-support-state">
        <ErrorState
          title="Seus tickets não carregaram"
          description={error || "Tente novamente."}
          onRetry={() => void load()}
        />
      </main>
    );
  }

  return (
    <main className="crz-support-page">
      <section className="crz-support-hero">
        <div className="crz-container crz-support-hero__inner">
          <div>
            <small>CRAZZY SUPPORT</small>
            <h1>Central de suporte</h1>
            <p>Abra tickets, envie arquivos e acompanhe cada resposta em uma thread privada.</p>
          </div>
          <a className="crz-button crz-button--primary crz-button--md" href="/tickets/novo">
            + Abrir ticket
          </a>
        </div>
      </section>

      <div className="crz-container crz-support-shell">
        <section className="crz-support-stats">
          {[
            ["Total", snapshot.stats.total, "ticket"],
            ["Em atendimento", snapshot.stats.open, "community"],
            ["Aguardando suporte", snapshot.stats.waitingStaff, "shield"],
            ["Sua vez", snapshot.stats.waitingUser, "lightning"],
          ].map(([label, value, icon]) => (
            <Panel className="crz-support-stat" key={String(label)}>
              <NeonIcon name={icon as "ticket" | "community" | "shield" | "lightning"} size={26} />
              <div>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            </Panel>
          ))}
        </section>

        <Panel className="crz-support-list-panel">
          <header>
            <div>
              <small>MEUS TICKETS</small>
              <h2>Conversas de suporte</h2>
            </div>
            <Badge tone="blue">{snapshot.tickets.length}</Badge>
          </header>

          {!snapshot.tickets.length ? (
            <EmptyState
              icon={<NeonIcon name="ticket" size={42} />}
              title="Nenhum ticket aberto"
              description="Quando precisar de ajuda, abra um ticket. Você pode anexar imagens, vídeos, áudios, PDF e TXT."
              action={<a className="crz-button crz-button--primary crz-button--md" href="/tickets/novo">Abrir primeiro ticket</a>}
            />
          ) : (
            <div className="crz-support-ticket-list">
              {snapshot.tickets.map((ticket) => {
                const status = statusMeta(ticket.status);
                return (
                  <a key={ticket.id} href={"/tickets/" + ticket.id} className="crz-support-ticket-card">
                    <div className="crz-support-ticket-card__icon">
                      <NeonIcon name="ticket" size={26} />
                    </div>
                    <div className="crz-support-ticket-card__main">
                      <div className="crz-support-ticket-card__top">
                        <small>{categoryLabels[ticket.category]} • #{ticket.id.slice(0, 8).toUpperCase()}</small>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      <strong>{ticket.subject}</strong>
                      <p>{ticket.lastMessagePreview || "Ticket criado. Aguardando primeira atualização."}</p>
                      <footer>
                        <span>{date(ticket.updatedAt)}</span>
                        {ticket.context.product && <span>{ticket.context.product.name}</span>}
                        {ticket.attachmentCount > 0 && <span>📎 {ticket.attachmentCount}</span>}
                      </footer>
                    </div>
                    <span className="crz-support-ticket-card__arrow">→</span>
                  </a>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}
