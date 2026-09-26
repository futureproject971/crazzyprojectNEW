"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NeonIcon, PageHeader } from "@/core/design-system";
import { useAuth } from "@/modules/auth/AuthProvider";
import type { RewardCampaign, RewardHistoryItem, RewardProduct, RewardSession } from "./types";

function youtubeEmbed(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return "https://www.youtube.com/embed/" + parsed.pathname.replace("/", "");
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
      return id ? "https://www.youtube.com/embed/" + id : null;
    }
  } catch {}
  return null;
}

function statusLabel(status: string) {
  const map: Record<string,string> = {
    watching: "Em andamento",
    completed: "Missão concluída",
    requested: "Resgate solicitado",
    delivering: "Preparando entrega",
    delivered: "Entregue",
    rejected: "Recusado",
  };
  return map[status] || status;
}

function seconds(value: number) {
  const total = Math.max(0, Math.round(value || 0));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return min ? min + "m " + sec + "s" : sec + "s";
}

export function RewardsPage() {
  const { user, loading: authLoading } = useAuth();
  const [campaigns, setCampaigns] = useState<RewardCampaign[]>([]);
  const [history, setHistory] = useState<RewardHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCampaign, setActiveCampaign] = useState<RewardCampaign | null>(null);
  const [activeProduct, setActiveProduct] = useState<RewardProduct | null>(null);
  const [session, setSession] = useState<RewardSession | null>(null);
  const [challenge, setChallenge] = useState<{ nonce: string; checkpoint_at_seconds: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const localPosition = useRef(0);
  const heartbeatBusy = useRef(false);

  const loadCatalog = useCallback(async () => {
    const response = await fetch("/api/rewards?action=catalog", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setCampaigns(payload.campaigns || []);
  }, []);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setHistory([]);
      return;
    }
    const response = await fetch("/api/rewards?action=history", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setHistory(payload.history || []);
  }, [user]);

  useEffect(() => {
    Promise.all([loadCatalog(), user ? loadHistory() : Promise.resolve()])
      .finally(() => setLoading(false));
  }, [loadCatalog, loadHistory, user]);

  const requiredSeconds = Number(activeCampaign?.required_watch_seconds || 0);
  const watchedSeconds = Number(session?.watched_seconds || 0);
  const progress = requiredSeconds ? Math.min(100, Math.round((watchedSeconds / requiredSeconds) * 100)) : 0;

  const startMission = async (campaign: RewardCampaign, product: RewardProduct) => {
    if (!user) {
      window.location.assign("/login");
      return;
    }

    setBusy(true);
    setNotice(null);
    const response = await fetch("/api/rewards?action=start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_product_id: product.id }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setNotice(payload?.error || "Não foi possível iniciar a missão.");
      return;
    }

    setActiveCampaign(campaign);
    setActiveProduct(product);
    setSession(payload.session);
    localPosition.current = Number(payload.session?.last_video_position || payload.session?.watched_seconds || 0);
  };

  const sendHeartbeat = useCallback(async () => {
    if (!session || session.status !== "watching" || heartbeatBusy.current || challenge) return;
    if (document.visibilityState !== "visible" || !document.hasFocus()) return;

    heartbeatBusy.current = true;
    localPosition.current += 8;

    const nonce = session.requirements_completed?.watch_guard?.next_heartbeat_nonce || "";
    const response = await fetch("/api/rewards?action=heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: session.id,
        visible: true,
        playing: true,
        position: localPosition.current,
        playback_rate: 1,
        heartbeat_nonce: nonce,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    heartbeatBusy.current = false;

    if (response.ok && payload.session) {
      setSession(payload.session);
      if (payload.challenge) setChallenge(payload.challenge);
    }
  }, [challenge, session]);

  useEffect(() => {
    if (!session || session.status !== "watching") return;
    const timer = window.setInterval(() => void sendHeartbeat(), 8000);
    return () => window.clearInterval(timer);
  }, [sendHeartbeat, session]);

  const confirmAttention = async () => {
    if (!session || !challenge) return;
    setBusy(true);
    const response = await fetch("/api/rewards?action=attention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id, challenge_nonce: challenge.nonce }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setNotice(payload?.error || "Não foi possível confirmar sua presença.");
      return;
    }
    if (payload.session) setSession(payload.session);
    setChallenge(null);
  };

  const requestReward = async () => {
    if (!session) return;
    setBusy(true);
    setNotice(null);
    const response = await fetch("/api/rewards?action=request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setNotice(payload?.error || "Não foi possível solicitar a recompensa.");
      return;
    }
    setSession(payload.session);
    setNotice(payload.session?.status === "delivered" ? "Recompensa entregue. Confira sua biblioteca." : "Resgate solicitado com sucesso.");
    void loadHistory();
  };

  useEffect(() => {
    if (!session || !["requested","delivering"].includes(session.status)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch("/api/rewards?action=status&session_id=" + encodeURIComponent(session.id), { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.session) {
        setSession(payload.session);
        if (payload.session.status === "delivered") {
          setNotice("Recompensa entregue. Confira sua biblioteca.");
          void loadHistory();
        }
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadHistory, session]);

  const activeEmbed = useMemo(() => activeCampaign ? youtubeEmbed(activeCampaign.video_url) : null, [activeCampaign]);

  return (
    <main className="crz-rewards-page">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY REWARDS"
          title="Missões e recompensas"
          description="Complete a missão, mantenha a página ativa e resgate a recompensa quando o progresso chegar a 100%."
          actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/club">Voltar ao CLUB</a>}
        />

        <p><a className="crz-button crz-button--primary crz-button--md" href="/club/luck?mode=drop">Girar drop diário grátis · cupons de 5% a 50%</a></p>

        {!authLoading && !user && (
          <div className="crz-rewards-login">
            <NeonIcon name="crown" size={36} />
            <div><strong>Entre para cumprir missões</strong><span>O catálogo pode ser visto por todos, mas progresso e resgate ficam vinculados à sua conta.</span></div>
            <a className="crz-button crz-button--primary crz-button--md" href="/login">Entrar</a>
          </div>
        )}

        {notice && <div className="crz-rewards-notice">{notice}</div>}

        <section className="crz-rewards-layout">
          <div className="crz-rewards-catalog">
            <header><span>MISSÕES DISPONÍVEIS</span><h2>Escolha sua recompensa</h2></header>

            {loading ? (
              <div className="crz-rewards-state"><span className="crz-spinner" /><p>Carregando missões...</p></div>
            ) : !campaigns.length ? (
              <div className="crz-rewards-state">
                <NeonIcon name="crown" size={34} />
                <strong>Nenhuma missão ativa agora</strong>
                <p>Novas missões e recompensas aparecerão aqui quando estiverem disponíveis.</p>
              </div>
            ) : (
              <div className="crz-rewards-cards">
                {campaigns.map((campaign) => (
                  <article className="crz-reward-card" key={campaign.id}>
                    <div className="crz-reward-card__copy">
                      <small>{seconds(campaign.required_watch_seconds)} de missão</small>
                      <h3>{campaign.title}</h3>
                      <p>{campaign.description}</p>
                    </div>
                    <div className="crz-reward-card__products">
                      {campaign.products.map((product) => (
                        <button
                          type="button"
                          key={product.id}
                          onClick={() => void startMission(campaign, product)}
                          disabled={busy}
                        >
                          {product.product?.image_url ? <img src={product.product.image_url} alt="" /> : <NeonIcon name="cube" size={28} />}
                          <span><strong>{product.product?.name || "Recompensa"}</strong><small>{product.plan?.name || product.trial_duration_minutes + " min"}</small></span>
                          <b>Começar</b>
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="crz-rewards-active">
            <header><span>MISSÃO ATUAL</span><h2>{activeCampaign?.title || "Nenhuma missão iniciada"}</h2></header>

            {!session || !activeCampaign ? (
              <div className="crz-rewards-state crz-rewards-state--active">
                <NeonIcon name="lightning" size={36} />
                <p>Escolha uma missão ao lado para começar.</p>
              </div>
            ) : (
              <>
                <div className="crz-rewards-video">
                  {activeEmbed ? (
                    <iframe src={activeEmbed} title={activeCampaign.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                  ) : activeCampaign.video_url ? (
                    <video src={activeCampaign.video_url} controls playsInline />
                  ) : (
                    <div><NeonIcon name="book" size={48} /><span>Conteúdo da missão</span></div>
                  )}
                </div>

                <div className="crz-rewards-progress">
                  <div><span>Progresso validado</span><strong>{progress}%</strong></div>
                  <div className="crz-rewards-progress__bar"><i style={{ width: progress + "%" }} /></div>
                  <small>{seconds(watchedSeconds)} / {seconds(requiredSeconds)}</small>
                </div>

                <div className="crz-rewards-session-meta">
                  <span>Status <strong>{statusLabel(session.status)}</strong></span>
                  <span>Prêmio <strong>{activeProduct?.product?.name || "Recompensa CRAZZY"}</strong></span>
                </div>

                {challenge && (
                  <div className="crz-rewards-attention">
                    <NeonIcon name="verified" size={28} />
                    <div><strong>Confirme que você está acompanhando</strong><span>O contador fica pausado até a confirmação.</span></div>
                    <button type="button" className="crz-button crz-button--primary crz-button--sm" disabled={busy} onClick={() => void confirmAttention()}>
                      Continuar missão
                    </button>
                  </div>
                )}

                {session.status === "completed" && (
                  <button type="button" className="crz-button crz-button--primary crz-button--lg" disabled={busy} onClick={() => void requestReward()}>
                    Resgatar recompensa
                  </button>
                )}

                {session.status === "delivered" && (
                  <a className="crz-button crz-button--primary crz-button--lg" href="/biblioteca">Abrir minha biblioteca</a>
                )}

                <p className="crz-rewards-watch-note">O progresso pausa quando a aba não está visível ou a janela não está ativa.</p>
              </>
            )}
          </aside>
        </section>

        <section className="crz-rewards-history">
          <header><div><span>HISTÓRICO</span><h2>Suas missões</h2></div><button type="button" onClick={() => void loadHistory()}>Atualizar</button></header>
          {!user ? (
            <div className="crz-rewards-state"><p>Entre para visualizar seu histórico.</p></div>
          ) : !history.length ? (
            <div className="crz-rewards-state"><p>Você ainda não concluiu nenhuma missão.</p></div>
          ) : (
            <div className="crz-rewards-history__list">
              {history.map((item) => (
                <article key={item.id}>
                  <div><strong>{item.campaign?.title || "Missão CRAZZY"}</strong><span>{item.product?.name || "Recompensa"}</span></div>
                  <div><small>{new Date(item.created_at).toLocaleDateString("pt-BR")}</small><b className={"is-" + item.status}>{statusLabel(item.status)}</b></div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
