"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, NeonIcon, PageHeader } from "@/core/design-system";
import type {
  RankLeaderboardItem,
  RankSnapshot,
  RankTier,
  RankTone,
} from "./types";

function formatPoints(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function tone(value: string): RankTone {
  return ["blue","green","gold","pink","neutral"].includes(value)
    ? (value as RankTone)
    : "blue";
}

const breakdownConfig = [
  { key: "purchase_points", countKey: "purchases", label: "Compras confirmadas", icon: "lightning", unit: "compra(s)" },
  { key: "entitlement_points", countKey: "active_entitlements", label: "Produtos ativos", icon: "cube", unit: "ativo(s)" },
  { key: "review_points", countKey: "reviews", label: "Avaliações verificadas", icon: "verified", unit: "avaliação(ões)" },
  { key: "reward_points", countKey: "rewards", label: "Rewards concluídos", icon: "featured", unit: "reward(s)" },
  { key: "luck_points", countKey: "luck_plays", label: "CRAZZY LUCK", icon: "crown", unit: "jogada(s)" },
  { key: "community_points", countKey: "community_messages", label: "Comunidade", icon: "community", unit: "mensagem(ns)" },
] as const;

export function RankPage() {
  const [snapshot, setSnapshot] = useState<RankSnapshot | null>(null);
  const [tiers, setTiers] = useState<RankTier[]>([]);
  const [leaderboard, setLeaderboard] = useState<RankLeaderboardItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "auth" | "error">("loading");
  const [error, setError] = useState("");

  const load = async () => {
    setState("loading");
    setError("");

    try {
      const [snapshotResponse, leaderboardResponse] = await Promise.all([
        fetch("/api/rank?action=snapshot", { cache: "no-store" }),
        fetch("/api/rank?action=leaderboard&limit=25", { cache: "no-store" }),
      ]);

      if (snapshotResponse.status === 401 || leaderboardResponse.status === 401) {
        setState("auth");
        return;
      }

      const snapshotPayload = await snapshotResponse.json();
      const leaderboardPayload = await leaderboardResponse.json();

      if (!snapshotResponse.ok) {
        throw new Error(snapshotPayload?.error || "Não foi possível carregar seu rank.");
      }
      if (!leaderboardResponse.ok) {
        throw new Error(leaderboardPayload?.error || "Não foi possível carregar o ranking.");
      }

      setSnapshot(snapshotPayload.snapshot as RankSnapshot);
      setTiers(snapshotPayload.tiers || []);
      setLeaderboard(leaderboardPayload.leaderboard || []);
      setState("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar CRAZZY RANK.");
      setState("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const currentPosition = useMemo(() => {
    if (!snapshot) return null;
    return leaderboard.find((item) => item.points === snapshot.points) || null;
  }, [leaderboard, snapshot]);

  return (
    <main className="crz-rank-page">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY RANK"
          title="Seu progresso no ecossistema"
          description="O rank é calculado no servidor usando atividade real da conta. Compras, produtos ativos, avaliações, Rewards, Luck e comunidade entram no progresso."
          actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/club">Voltar ao CLUB</a>}
        />

        {state === "loading" && (
          <section className="crz-rank-state">
            <span className="crz-spinner" />
            <p>Calculando seu rank...</p>
          </section>
        )}

        {state === "auth" && (
          <section className="crz-rank-state">
            <NeonIcon name="crown" size={46} />
            <strong>Entre para ver seu rank</strong>
            <p>Seu progresso é vinculado à sua conta CRAZZY.</p>
            <a className="crz-button crz-button--primary crz-button--md" href="/login">Entrar</a>
          </section>
        )}

        {state === "error" && (
          <section className="crz-rank-state">
            <NeonIcon name="shield" size={42} />
            <strong>Rank indisponível agora</strong>
            <p>{error}</p>
            <button className="crz-button crz-button--secondary crz-button--sm" type="button" onClick={() => void load()}>
              Tentar novamente
            </button>
          </section>
        )}

        {state === "ready" && snapshot && (
          <>
            <section className="crz-rank-hero-card" style={{ "--rank-color": snapshot.current.color } as React.CSSProperties}>
              <div className="crz-rank-hero-card__glow" />
              <div className="crz-rank-hero-card__emblem">
                <div><NeonIcon name="crown" size={54} /></div>
                <span>{snapshot.current.code.toUpperCase()}</span>
              </div>

              <div className="crz-rank-hero-card__main">
                <small>SEU RANK ATUAL</small>
                <h2>{snapshot.current.label}</h2>
                <div className="crz-rank-points">
                  <strong>{formatPoints(snapshot.points)}</strong>
                  <span>XP CRAZZY</span>
                </div>

                <div className="crz-rank-progress">
                  <div>
                    <span>{snapshot.current.label}</span>
                    <span>{snapshot.next ? snapshot.next.label : "RANK MÁXIMO"}</span>
                  </div>
                  <div className="crz-rank-progress__track">
                    <i style={{ width: Math.max(2, Number(snapshot.progress_percent || 0)) + "%" }} />
                  </div>
                  <footer>
                    <span>{Number(snapshot.progress_percent || 0).toFixed(0)}% da faixa</span>
                    <strong>
                      {snapshot.next
                        ? formatPoints(snapshot.next.points_needed || 0) + " XP para subir"
                        : "Você chegou ao topo"}
                    </strong>
                  </footer>
                </div>
              </div>

              <aside className="crz-rank-hero-card__position">
                <small>POSIÇÃO</small>
                <strong>{currentPosition ? "#" + currentPosition.position : "—"}</strong>
                <span>ranking CRAZZY</span>
              </aside>
            </section>

            <section className="crz-rank-breakdown">
              <header>
                <div><small>COMO SEU XP É FORMADO</small><h2>Progresso verificável</h2></div>
                <span>O navegador não concede pontos.</span>
              </header>

              <div className="crz-rank-breakdown__grid">
                {breakdownConfig.map((item) => {
                  const points = Number(snapshot.breakdown[item.key] || 0);
                  const count = Number(snapshot.breakdown[item.countKey] || 0);
                  return (
                    <article key={item.key}>
                      <NeonIcon name={item.icon} size={25} />
                      <div>
                        <strong>{item.label}</strong>
                        <span>{count} {item.unit}</span>
                      </div>
                      <b>+{formatPoints(points)} XP</b>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="crz-rank-tiers">
              <header><small>ESCADA CRAZZY</small><h2>Todos os ranks</h2></header>
              <div>
                {tiers.map((tier) => {
                  const reached = snapshot.points >= tier.min_points;
                  const active = snapshot.current.code === tier.code;
                  return (
                    <article
                      key={tier.code}
                      className={(reached ? "is-reached " : "") + (active ? "is-active" : "")}
                      style={{ "--tier-color": tier.color } as React.CSSProperties}
                    >
                      <div><NeonIcon name="crown" size={24} /></div>
                      <strong>{tier.label}</strong>
                      <span>{formatPoints(tier.min_points)} XP</span>
                      {active && <Badge tone={tone(tier.tone)}>ATUAL</Badge>}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="crz-rank-board">
              <header>
                <div><small>TOP CRAZZY</small><h2>Leaderboard</h2></div>
                <button type="button" onClick={() => void load()}>↻ Atualizar</button>
              </header>

              <div className="crz-rank-board__list">
                {leaderboard.map((item) => (
                  <article
                    key={item.user_id}
                    className={item.points === snapshot.points ? "is-me" : ""}
                    style={{ "--entry-color": item.rank_color || "#2AA8FF" } as React.CSSProperties}
                  >
                    <b className="crz-rank-board__position">#{item.position}</b>
                    <div className="crz-rank-board__avatar">
                      {item.avatar_url ? <img src={item.avatar_url} alt="" /> : <NeonIcon name="verified" size={22} />}
                    </div>
                    <div className="crz-rank-board__identity">
                      <strong>{item.name}</strong>
                      <span style={{ color: item.rank_color }}>{item.rank_label}</span>
                    </div>
                    <Badge tone={tone(item.rank_tone)}>{item.rank_label.toUpperCase()}</Badge>
                    <strong className="crz-rank-board__points">{formatPoints(item.points)} XP</strong>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
