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
import { useAuth } from "@/modules/auth/AuthProvider";
import type {
  ClientHubSnapshot,
  HubEntitlement,
  HubOrder,
  HubPayment,
} from "./types";

type HubTab = "overview" | "orders" | "products" | "tutorials" | "deliveries" | "discord";

const tabs: Array<{ id: HubTab; label: string; icon: "verified" | "cube" | "book" | "ticket" | "community" | "shield" }> = [
  { id: "overview", label: "Visão geral", icon: "verified" },
  { id: "orders", label: "Compras", icon: "ticket" },
  { id: "products", label: "Produtos", icon: "cube" },
  { id: "tutorials", label: "Tutoriais", icon: "book" },
  { id: "deliveries", label: "Entregas", icon: "shield" },
  { id: "discord", label: "Discord", icon: "community" },
];

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function entitlementTone(status: HubEntitlement["status"]) {
  if (status === "active") return "green" as const;
  if (status === "expired") return "neutral" as const;
  if (status === "revoked" || status === "refunded" || status === "disputed") return "red" as const;
  return "neutral" as const;
}

function entitlementLabel(status: HubEntitlement["status"]) {
  const labels = {
    active: "ATIVO",
    expired: "EXPIRADO",
    revoked: "REVOGADO",
    refunded: "REEMBOLSADO",
    disputed: "EM DISPUTA",
  } as const;
  return labels[status];
}

function paymentStatus(status: string) {
  const value = status.toUpperCase();
  if (value === "COMPLETED") return { label: "PAGO", tone: "green" as const };
  if (value === "ACTIVE" || value === "CREATING") return { label: "PENDENTE", tone: "gold" as const };
  if (value === "EXPIRED") return { label: "EXPIRADO", tone: "neutral" as const };
  return { label: value, tone: "red" as const };
}

function methodLabel(method: string | null) {
  if (method === "pix") return "PIX";
  if (method === "card") return "Cartão";
  if (method === "crypto") return "Litecoin";
  return method || "—";
}

function OrdersList({
  orders,
  payments,
}: {
  orders: HubOrder[];
  payments: HubPayment[];
}) {
  if (!orders.length && !payments.length) {
    return (
      <EmptyState
        icon={<NeonIcon name="ticket" size={38} />}
        title="Nenhuma compra ainda"
        description="Seus pedidos e pagamentos aparecerão aqui."
        action={<a className="crz-button crz-button--primary crz-button--md" href="/produtos">Ver produtos</a>}
      />
    );
  }

  return (
    <div className="crz-hub-order-list">
      {orders.map((order) => (
        <article className="crz-hub-order" key={order.id}>
          <div className="crz-hub-order__icon"><NeonIcon name="cube" size={26} /></div>
          <div className="crz-hub-order__main">
            <small>PEDIDO #{order.id.slice(0, 8).toUpperCase()}</small>
            <strong>{order.productName}</strong>
            <span>{order.planName} • {date(order.createdAt)}</span>
          </div>
          <div className="crz-hub-order__status">
            <Badge tone={order.status === "completed" || order.status === "delivered" ? "green" : "blue"}>
              {order.statusLabel}
            </Badge>
            <small>Atualizado {date(order.updatedAt)}</small>
          </div>
        </article>
      ))}

      {payments.map((payment) => {
        const status = paymentStatus(payment.status);
        return (
          <article className="crz-hub-order crz-hub-order--payment" key={payment.id}>
            <div className="crz-hub-order__icon"><NeonIcon name="lightning" size={26} /></div>
            <div className="crz-hub-order__main">
              <small>PAGAMENTO #{payment.id.slice(0, 8).toUpperCase()}</small>
              <strong>{money(payment.amountCents)}</strong>
              <span>{methodLabel(payment.method)} • {date(payment.createdAt)}</span>
            </div>
            <div className="crz-hub-order__status">
              <Badge tone={status.tone}>{status.label}</Badge>
              {payment.paidAt && <small>Pago em {date(payment.paidAt)}</small>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ClientHubPage({ initialTab = "overview" }: { initialTab?: HubTab }) {
  const { user, signIn, linkDiscord } = useAuth();
  const [snapshot, setSnapshot] = useState<ClientHubSnapshot | null>(null);
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  const load = async () => {
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/client-hub", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar o painel.");
      setSnapshot(payload as ClientHubSnapshot);
      setState("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar o painel.");
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activeProducts = useMemo(
    () => snapshot?.entitlements.filter((item) => item.status === "active") || [],
    [snapshot]
  );

  const syncDiscord = async () => {
    setSyncing(true);
    setSyncError("");
    try {
      if (snapshot?.discord.connected) {
        await signIn("discord", "/painel?tab=discord");
      } else {
        await linkDiscord("/painel?tab=discord");
      }
    } catch (syncFailure) {
      setSyncError(syncFailure instanceof Error ? syncFailure.message : "Não foi possível abrir o Discord.");
      setSyncing(false);
    }
  };

  if (state === "loading") {
    return (
      <main className="crz-hub-page crz-hub-state">
        <LoadingState label="Montando seu painel CRAZZY..." />
      </main>
    );
  }

  if (state === "error" || !snapshot) {
    return (
      <main className="crz-hub-page crz-hub-state">
        <ErrorState
          title="Seu painel não carregou"
          description={error || "Tente novamente."}
          onRetry={() => void load()}
        />
      </main>
    );
  }

  return (
    <main className="crz-hub-page">
      <section className="crz-hub-hero">
        <div className="crz-container crz-hub-hero__inner">
          <div className="crz-hub-profile">
            <div className="crz-hub-profile__avatar">
              {snapshot.profile.avatarUrl ? (
                <img src={snapshot.profile.avatarUrl} alt="" />
              ) : (
                <NeonIcon name="verified" size={36} />
              )}
            </div>
            <div>
              <small>CRAZZY CLIENT HUB</small>
              <h1>Salve, {snapshot.profile.username}</h1>
              <p>Compras, produtos, tutoriais, entregas e Discord em um só lugar.</p>
            </div>
          </div>

          <div className="crz-hub-hero__badges">
            <Badge tone="blue">{snapshot.profile.role.toUpperCase()}</Badge>
            {snapshot.discord.connected && (
              <Badge tone={snapshot.discord.guildMember ? "green" : "neutral"}>
                {snapshot.discord.guildMember ? "DISCORD VERIFICADO" : "DISCORD CONECTADO"}
              </Badge>
            )}
          </div>
        </div>
      </section>

      <div className="crz-container crz-hub-shell">
        <aside className="crz-hub-sidebar">
          <nav>
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? "is-active" : ""}
                onClick={() => setTab(item.id)}
              >
                <NeonIcon name={item.icon} size={19} />
                <span>{item.label}</span>
                {item.id === "orders" && snapshot.stats.orders > 0 && <b>{snapshot.stats.orders}</b>}
                {item.id === "products" && activeProducts.length > 0 && <b>{activeProducts.length}</b>}
                {item.id === "tutorials" && snapshot.stats.tutorials > 0 && <b>{snapshot.stats.tutorials}</b>}
              </button>
            ))}
          </nav>

          <div className="crz-hub-sidebar__support">
            <NeonIcon name="ticket" size={23} />
            <div>
              <strong>Precisa de ajuda?</strong>
              <span>Abra um ticket com contexto da sua compra.</span>
            </div>
            <a href="/tickets">Abrir ticket →</a>
          </div>
        </aside>

        <section className="crz-hub-content">
          {tab === "overview" && (
            <>
              <div className="crz-hub-stats">
                {[
                  ["Compras pagas", snapshot.stats.completedPayments, "lightning"],
                  ["Produtos ativos", snapshot.stats.activeProducts, "cube"],
                  ["Tutoriais", snapshot.stats.tutorials, "book"],
                  ["Cargos Discord", snapshot.stats.roleGrants, "community"],
                ].map(([label, value, icon]) => (
                  <Panel className="crz-hub-stat" key={String(label)}>
                    <NeonIcon name={icon as "lightning" | "cube" | "book" | "community"} size={27} />
                    <div>
                      <strong>{value}</strong>
                      <span>{label}</span>
                    </div>
                  </Panel>
                ))}
              </div>

              <div className="crz-hub-overview-grid">
                <Panel className="crz-hub-panel">
                  <header>
                    <div>
                      <small>ACESSOS</small>
                      <h2>Produtos ativos</h2>
                    </div>
                    <button type="button" onClick={() => setTab("products")}>Ver todos →</button>
                  </header>

                  {!activeProducts.length ? (
                    <div className="crz-hub-mini-empty">
                      <NeonIcon name="cube" size={30} />
                      <span>Nenhum entitlement ativo ainda.</span>
                    </div>
                  ) : (
                    <div className="crz-hub-product-list">
                      {activeProducts.slice(0, 4).map((item) => (
                        <article key={item.id}>
                          <div className="crz-hub-product-list__art">
                            {item.productImage ? <img src={item.productImage} alt="" /> : <NeonIcon name="cube" size={28} />}
                          </div>
                          <div>
                            <strong>{item.productName}</strong>
                            <span>{item.planName || "Plano CRAZZY"}</span>
                          </div>
                          <Badge tone="green">ATIVO</Badge>
                        </article>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel className="crz-hub-panel">
                  <header>
                    <div>
                      <small>DISCORD</small>
                      <h2>Status da conexão</h2>
                    </div>
                    <button type="button" onClick={() => setTab("discord")}>Detalhes →</button>
                  </header>

                  <div className="crz-hub-discord-card">
                    <div className="crz-hub-discord-card__avatar">
                      {snapshot.discord.avatarUrl ? (
                        <img src={snapshot.discord.avatarUrl} alt="" />
                      ) : (
                        <img src="/icons/brand-discord.svg" alt="" />
                      )}
                    </div>
                    <div>
                      <strong>{snapshot.discord.username || "Discord não conectado"}</strong>
                      <span>
                        {!snapshot.discord.connected
                          ? "Conecte para sincronizar identidade e cargos."
                          : !snapshot.discord.guildConfigured
                            ? "Servidor oficial ainda não configurado no backend."
                            : snapshot.discord.guildMember
                              ? "Membro do servidor oficial verificado."
                              : "Conta conectada, fora do servidor no último sync."}
                      </span>
                    </div>
                  </div>
                </Panel>
              </div>

              <Panel className="crz-hub-panel">
                <header>
                  <div>
                    <small>ATIVIDADE RECENTE</small>
                    <h2>Compras e pedidos</h2>
                  </div>
                  <button type="button" onClick={() => setTab("orders")}>Histórico →</button>
                </header>
                <OrdersList
                  orders={snapshot.orders.slice(0, 4)}
                  payments={snapshot.orders.length ? [] : snapshot.payments.slice(0, 4)}
                />
              </Panel>
            </>
          )}

          {tab === "orders" && (
            <Panel className="crz-hub-panel">
              <header>
                <div>
                  <small>HISTÓRICO</small>
                  <h2>Minhas compras</h2>
                </div>
                <Badge tone="blue">{snapshot.stats.payments} pagamentos</Badge>
              </header>
              <OrdersList orders={snapshot.orders} payments={snapshot.payments} />
            </Panel>
          )}

          {tab === "products" && (
            <Panel className="crz-hub-panel">
              <header>
                <div>
                  <small>ENTITLEMENTS</small>
                  <h2>Meus produtos</h2>
                </div>
                <Badge tone="green">{activeProducts.length} ativos</Badge>
              </header>

              {!snapshot.entitlements.length ? (
                <EmptyState
                  icon={<NeonIcon name="cube" size={38} />}
                  title="Nenhum produto liberado"
                  description="Após o fulfillment, seu direito de acesso aparece aqui automaticamente."
                  action={<a className="crz-button crz-button--primary crz-button--md" href="/produtos">Ver produtos</a>}
                />
              ) : (
                <div className="crz-hub-entitlement-grid">
                  {snapshot.entitlements.map((item) => (
                    <article key={item.id} className="crz-hub-entitlement">
                      <div className="crz-hub-entitlement__art">
                        {item.productImage ? <img src={item.productImage} alt="" /> : <NeonIcon name="cube" size={42} />}
                      </div>
                      <div className="crz-hub-entitlement__body">
                        <div>
                          <small>{item.planName || item.planCode || "PLANO"}</small>
                          <strong>{item.productName}</strong>
                          <span>{item.productStatusLabel}</span>
                        </div>
                        <Badge tone={entitlementTone(item.status)}>{entitlementLabel(item.status)}</Badge>
                      </div>
                      <footer>
                        <span>Início: {date(item.startsAt)}</span>
                        <span>{item.expiresAt ? "Expira: " + date(item.expiresAt) : "Sem expiração"}</span>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === "tutorials" && (
            <Panel className="crz-hub-panel">
              <header>
                <div>
                  <small>ACESSO LIBERADO</small>
                  <h2>Meus tutoriais</h2>
                </div>
                <Badge tone="blue">{snapshot.tutorials.length}</Badge>
              </header>

              {!snapshot.tutorials.length ? (
                <EmptyState
                  icon={<NeonIcon name="book" size={38} />}
                  title="Nenhum tutorial liberado"
                  description="Tutoriais associados aos seus produtos aparecerão aqui."
                />
              ) : (
                <div className="crz-hub-tutorial-list">
                  {snapshot.tutorials.map((item) => (
                    <article key={item.entitlementId}>
                      <div className="crz-hub-tutorial-list__art">
                        {item.productImage ? <img src={item.productImage} alt="" /> : <NeonIcon name="book" size={31} />}
                      </div>
                      <div>
                        <small>TUTORIAL LIBERADO</small>
                        <strong>{item.productName}</strong>
                        <span>
                          {item.entitlementStatus === "active"
                            ? "Acesso ativo"
                            : "Acesso preservado pelo histórico do produto"}
                        </span>
                      </div>
                      <button type="button" disabled title="Viewer protegido entra no M22">
                        Viewer M22
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === "deliveries" && (
            <Panel className="crz-hub-panel">
              <header>
                <div>
                  <small>FULFILLMENT</small>
                  <h2>Entregas</h2>
                </div>
                <a href="/biblioteca">Abrir biblioteca →</a>
              </header>

              {!snapshot.orders.length && !snapshot.rewardDeliveries.length ? (
                <EmptyState
                  icon={<NeonIcon name="shield" size={38} />}
                  title="Nenhuma entrega registrada"
                  description="O M10 mostra apenas status. Keys, contas e links sensíveis serão revelados no M11 Library."
                />
              ) : (
                <div className="crz-hub-delivery-list">
                  {snapshot.orders.map((order) => (
                    <article key={order.id}>
                      <NeonIcon name="shield" size={24} />
                      <div>
                        <strong>{order.productName}</strong>
                        <span>{order.planName} • {order.statusLabel}</span>
                      </div>
                      <small>{date(order.updatedAt)}</small>
                    </article>
                  ))}
                  {snapshot.rewardDeliveries.map((delivery) => (
                    <article key={delivery.id}>
                      <NeonIcon name="crown" size={24} />
                      <div>
                        <strong>Entrega de recompensa</strong>
                        <span>{delivery.mode}</span>
                      </div>
                      <small>{date(delivery.deliveredAt)}</small>
                    </article>
                  ))}
                </div>
              )}

              <div className="crz-hub-sensitive-note">
                <NeonIcon name="shield" size={23} />
                <span>Conteúdo sensível de entrega nunca é retornado pelo Client Hub. O M11 fará revelação/cópia com proteção própria.</span>
              </div>
            </Panel>
          )}

          {tab === "discord" && (
            <div className="crz-hub-discord-layout">
              <Panel className="crz-hub-panel">
                <header>
                  <div>
                    <small>DISCORD SYNC</small>
                    <h2>Conta conectada</h2>
                  </div>
                  <Badge tone={snapshot.discord.connected ? "green" : "neutral"}>
                    {snapshot.discord.connected ? "CONECTADO" : "PENDENTE"}
                  </Badge>
                </header>

                <div className="crz-hub-discord-detail">
                  <div className="crz-hub-discord-detail__avatar">
                    {snapshot.discord.avatarUrl ? (
                      <img src={snapshot.discord.avatarUrl} alt="" />
                    ) : (
                      <img src="/icons/brand-discord.svg" alt="" />
                    )}
                  </div>
                  <div>
                    <strong>{snapshot.discord.username || "Nenhum Discord vinculado"}</strong>
                    <span>
                      {snapshot.discord.lastCheckedAt
                        ? "Última verificação: " + date(snapshot.discord.lastCheckedAt)
                        : "Aguardando primeira sincronização"}
                    </span>
                    {snapshot.discord.guildConfigured && (
                      <small>
                        {snapshot.discord.guildMember
                          ? "✓ Membro do servidor oficial"
                          : "Servidor configurado • membership não confirmado"}
                      </small>
                    )}
                  </div>
                </div>

                <Button
                  variant="secondary"
                  disabled={syncing}
                  onClick={() => void syncDiscord()}
                  leadingIcon={<NeonIcon name="community" size={19} />}
                >
                  {syncing
                    ? "Abrindo Discord..."
                    : snapshot.discord.connected
                      ? "Reconectar / atualizar Discord"
                      : "Conectar Discord"}
                </Button>

                {syncError && <div className="crz-hub-inline-error">{syncError}</div>}
              </Panel>

              <Panel className="crz-hub-panel">
                <header>
                  <div>
                    <small>CARGOS</small>
                    <h2>Roles e benefícios</h2>
                  </div>
                  <Badge tone="blue">{snapshot.roleGrants.length}</Badge>
                </header>

                <div className="crz-hub-app-roles">
                  {snapshot.profile.roles.map((role) => (
                    <span key={role}>{role.toUpperCase()}</span>
                  ))}
                </div>

                {!snapshot.roleGrants.length ? (
                  <div className="crz-hub-mini-empty">
                    <NeonIcon name="community" size={30} />
                    <span>Nenhum cargo de produto registrado ainda. O M44 Discord Bridge será o escritor desta fila.</span>
                  </div>
                ) : (
                  <div className="crz-hub-role-list">
                    {snapshot.roleGrants.map((role) => (
                      <article key={role.id}>
                        <NeonIcon name="community" size={22} />
                        <strong>{role.roleName}</strong>
                        <Badge tone={role.status === "granted" ? "green" : role.status === "failed" ? "red" : "gold"}>
                          {role.status.toUpperCase()}
                        </Badge>
                      </article>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
