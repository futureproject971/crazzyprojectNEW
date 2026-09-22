"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NeonIcon, PageHeader } from "@/core/design-system";
import { useAuth } from "@/modules/auth/AuthProvider";
import type { LuckCampaign, LuckHistoryItem, LuckMode, LuckPrize, LuckResult } from "./types";

const modeLabels: Record<LuckMode, string> = {
  wheel: "Roleta",
  scratch: "Raspadinha",
  drop: "Drops",
};

const palette = ["#0066ff", "#00b8ff", "#7c3cff", "#ff2f9b", "#00d7b0", "#ffc33d", "#335cff"];

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "luck-" + Date.now() + "-" + Math.random().toString(36).slice(2, 14);
}

function wheelBackground(prizes: LuckPrize[]) {
  if (!prizes.length) return "conic-gradient(#0b1730 0 100%)";
  let cursor = 0;
  const stops: string[] = [];
  prizes.forEach((prize, index) => {
    const size = Math.max(0, Number(prize.chance_percent || 0));
    const end = Math.min(100, cursor + size);
    const color = palette[index % palette.length];
    stops.push(color + " " + cursor.toFixed(2) + "% " + end.toFixed(2) + "%");
    cursor = end;
  });
  if (cursor < 100) stops.push("#0d1a31 " + cursor.toFixed(2) + "% 100%");
  return "conic-gradient(" + stops.join(",") + ")";
}

function prizeCenterAngle(prizes: LuckPrize[], prizeId: string) {
  let cursor = 0;
  for (const prize of prizes) {
    const chance = Number(prize.chance_percent || 0);
    if (prize.id === prizeId) return (cursor + chance / 2) * 3.6;
    cursor += chance;
  }
  return 0;
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function PrizeResult({ result }: { result: LuckResult }) {
  return (
    <div className="crz-luck-result">
      <span>VOCÊ GANHOU</span>
      <strong>{result.prize_label}</strong>
      <small>Chance desta recompensa: {Number(result.chance_percent).toFixed(2)}%</small>
      {result.coupon_code && (
        <div className="crz-luck-result__coupon">
          <label>SEU CUPOM</label>
          <code>{result.coupon_code}</code>
          <button type="button" onClick={() => navigator.clipboard?.writeText(result.coupon_code || "")}>
            Copiar
          </button>
        </div>
      )}
      {result.coupon_expires_at && <em>Válido até {formatDate(result.coupon_expires_at)}</em>}
      {result.delivery_status === "pending" && <em>Prêmio no forno. Já já cai.</em>}
    </div>
  );
}

function WheelGame({
  campaign,
  result,
  spinning,
  rotation,
  onPlay,
}: {
  campaign: LuckCampaign;
  result: LuckResult | null;
  spinning: boolean;
  rotation: number;
  onPlay: () => void;
}) {
  return (
    <div className="crz-luck-wheel-layout">
      <div className="crz-luck-wheel-wrap">
        <div className="crz-luck-wheel-pointer" aria-hidden="true">▼</div>
        <div
          className={"crz-luck-wheel " + (spinning ? "is-spinning" : "")}
          style={{
            background: wheelBackground(campaign.prizes),
            transform: "rotate(" + rotation + "deg)",
          }}
        >
          <div className="crz-luck-wheel__rings" />
          <div className="crz-luck-wheel__hub">
            <img src="/brand/crazzy-logo-hero.png" alt="" aria-hidden="true" />
            <span>LUCK</span>
          </div>
        </div>
      </div>

      <div className="crz-luck-game-actions">
        {result ? <PrizeResult result={result} /> : (
          <>
            <strong>Uma jogada. O servidor bate o martelo.</strong>
            <p>A animação só faz o show. O prêmio já saiu no servidor antes.</p>
          </>
        )}
        <button type="button" className="crz-button crz-button--primary crz-button--lg" disabled={spinning} onClick={onPlay}>
          {spinning ? "RODANDO..." : "GIRAR E VER NO QUE DÁ"}
        </button>
      </div>
    </div>
  );
}

function ScratchGame({
  result,
  busy,
  onPlay,
}: {
  result: LuckResult | null;
  busy: boolean;
  onPlay: () => void;
}) {
  const [scratched, setScratched] = useState<Set<number>>(new Set());
  const [pointerDown, setPointerDown] = useState(false);

  useEffect(() => setScratched(new Set()), [result?.play_id]);

  const scratch = (index: number) => {
    if (!result) return;
    setScratched((current) => {
      const next = new Set(current);
      next.add(index);
      if (next.size >= 22) {
        for (let i = 0; i < 36; i += 1) next.add(i);
      }
      return next;
    });
  };

  return (
    <div className="crz-luck-scratch-layout">
      <div className="crz-luck-scratch-card">
        <div className="crz-luck-scratch-prize">
          {result ? <PrizeResult result={result} /> : (
            <div><NeonIcon name="crown" size={52} /><strong>CRAZZY SCRATCH</strong><span>Puxa tua raspadinha e mete a unha</span></div>
          )}
        </div>
        {result && (
          <div
            className="crz-luck-scratch-cover"
            onPointerDown={() => setPointerDown(true)}
            onPointerUp={() => setPointerDown(false)}
            onPointerLeave={() => setPointerDown(false)}
          >
            {Array.from({ length: 36 }, (_, index) => (
              <button
                type="button"
                aria-label="Raspar"
                key={index}
                className={scratched.has(index) ? "is-scratched" : ""}
                onPointerDown={() => scratch(index)}
                onPointerEnter={() => pointerDown && scratch(index)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="crz-luck-game-actions">
        <strong>{result ? "Raspa aí e descobre a treta." : "A raspadinha do dia tá te encarando."}</strong>
        <p>O prêmio nasce no servidor antes da raspada. Mexer no visual não muda o destino.</p>
        {!result && (
          <button type="button" className="crz-button crz-button--primary crz-button--lg" disabled={busy} onClick={onPlay}>
            {busy ? "PREPARANDO..." : "GERAR RASPADINHA"}
          </button>
        )}
      </div>
    </div>
  );
}

function DropGame({
  result,
  busy,
  opening,
  onPlay,
}: {
  result: LuckResult | null;
  busy: boolean;
  opening: boolean;
  onPlay: () => void;
}) {
  return (
    <div className="crz-luck-drop-layout">
      <div className={"crz-luck-drop-box " + (opening ? "is-opening" : "") + (result ? " is-open" : "")}>
        <div className="crz-luck-drop-box__lid" />
        <div className="crz-luck-drop-box__body">
          <NeonIcon name="crown" size={56} />
          <strong>CRAZZY DROP</strong>
        </div>
        <div className="crz-luck-drop-box__light" />
      </div>

      <div className="crz-luck-game-actions">
        {result ? <PrizeResult result={result} /> : (
          <>
            <strong>Abre o drop do dia e vê o estrago.</strong>
            <p>O servidor decide primeiro. A caixa só faz suspense.</p>
          </>
        )}
        <button type="button" className="crz-button crz-button--primary crz-button--lg" disabled={busy || opening} onClick={onPlay}>
          {opening ? "ABRINDO..." : result ? "Drop estourado" : "ABRIR O DROP"}
        </button>
      </div>
    </div>
  );
}

export function LuckPage() {
  const { user, loading: authLoading } = useAuth();
  const [campaigns, setCampaigns] = useState<LuckCampaign[]>([]);
  const [history, setHistory] = useState<LuckHistoryItem[]>([]);
  const [mode, setMode] = useState<LuckMode>("wheel");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [opening, setOpening] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<LuckResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    const response = await fetch("/api/luck?action=catalog", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setCampaigns(payload.campaigns || []);
    else setNotice(payload?.error || "O CRAZZY LUCK não entrou no mapa agora.");
  }, []);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setHistory([]);
      return;
    }
    const response = await fetch("/api/luck?action=history", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setHistory(payload.history || []);
  }, [user]);

  useEffect(() => {
    Promise.all([loadCatalog(), user ? loadHistory() : Promise.resolve()]).finally(() => setLoading(false));
  }, [loadCatalog, loadHistory, user]);

  const campaign = useMemo(
    () => campaigns.find((item) => item.mode === mode) || null,
    [campaigns, mode]
  );

  const chooseMode = (next: LuckMode) => {
    setMode(next);
    setResult(null);
    setNotice(null);
    setRotation(0);
    setOpening(false);
  };

  const play = async () => {
    if (!user) {
      window.location.assign("/login");
      return;
    }
    if (!campaign || busy) return;

    setBusy(true);
    setNotice(null);
    if (mode === "wheel") setSpinning(true);
    if (mode === "drop") setOpening(true);

    const response = await fetch("/api/luck?action=play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignSlug: campaign.slug,
        idempotencyKey: createIdempotencyKey(),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setBusy(false);
      setSpinning(false);
      setOpening(false);
      setNotice(payload?.error || "Essa jogada não saiu. Tenta mais uma.");
      return;
    }

    const next = payload.result as LuckResult;

    if (mode === "wheel") {
      const target = prizeCenterAngle(campaign.prizes, next.prize_id);
      setRotation((current) => current + 2160 + (360 - target));
      window.setTimeout(() => {
        setResult(next);
        setSpinning(false);
        setBusy(false);
        void loadHistory();
      }, 3200);
      return;
    }

    if (mode === "drop") {
      window.setTimeout(() => {
        setResult(next);
        setOpening(false);
        setBusy(false);
        void loadHistory();
      }, 1700);
      return;
    }

    setResult(next);
    setBusy(false);
    void loadHistory();
  };

  return (
    <main className="crz-luck-page">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY LUCK"
          title="Roleta, raspadinha e drop no caos certo"
          description="Prêmio real, chance na mesa e resultado decidido no servidor. Sem truque."
          actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/club">VOLTAR PRO CLUB</a>}
        />

        <div className="crz-luck-rules">
          <NeonIcon name="shield" size={28} />
          <div>
            <strong>1 jogada grátis por dia. Escolhe teu veneno.</strong>
            <span>Escolhe o modo. Prêmio e log nascem no servidor antes do show.</span>
          </div>
        </div>

        {notice && <div className="crz-luck-notice">{notice}</div>}

        <div className="crz-luck-tabs">
          {(["wheel","scratch","drop"] as LuckMode[]).map((item) => (
            <button type="button" key={item} className={mode === item ? "is-active" : ""} onClick={() => chooseMode(item)}>
              <NeonIcon name={item === "wheel" ? "featured" : item === "scratch" ? "customization" : "cube"} size={22} />
              <span>{modeLabels[item]}</span>
            </button>
          ))}
        </div>

        <section className="crz-luck-main">
          <div className={"crz-luck-game crz-luck-game--" + mode}>
            {loading ? (
              <div className="crz-luck-state"><span className="crz-spinner" /><p>Puxando as chances...</p></div>
            ) : !campaign ? (
              <div className="crz-luck-state"><NeonIcon name="crown" size={40} /><strong>Esse modo saiu do round</strong><p>Tá pausado agora. Já já volta a bagunça.</p></div>
            ) : mode === "wheel" ? (
              <WheelGame campaign={campaign} result={result} spinning={spinning} rotation={rotation} onPlay={() => void play()} />
            ) : mode === "scratch" ? (
              <ScratchGame result={result} busy={busy} onPlay={() => void play()} />
            ) : (
              <DropGame result={result} busy={busy} opening={opening} onPlay={() => void play()} />
            )}
          </div>

          <aside className="crz-luck-odds">
            <header><span>CHANCES NA MESA</span><h2>{campaign?.title || "Prêmios"}</h2></header>
            <p>Essas porcentagens vêm direto dos pesos ativos no servidor.</p>
            <div className="crz-luck-odds__list">
              {(campaign?.prizes || []).map((prize, index) => (
                <div key={prize.id}>
                  <i style={{ background: palette[index % palette.length] }} />
                  <span>{prize.label}<small>{prize.prize_type === "coupon" ? "Cupom" : prize.prize_type}</small></span>
                  <strong>{Number(prize.chance_percent).toFixed(2)}%</strong>
                </div>
              ))}
            </div>
            {!authLoading && !user && <a className="crz-button crz-button--primary crz-button--md" href="/login">ENTRAR E JOGAR</a>}
          </aside>
        </section>

        <section className="crz-luck-history">
          <header><div><span>SEU HISTÓRICO</span><h2>Teus giros e teus drops</h2></div><button type="button" onClick={() => void loadHistory()}>Atualizar</button></header>
          {!user ? (
            <div className="crz-luck-state crz-luck-state--small"><p>Entra aí pra ver teu histórico.</p></div>
          ) : !history.length ? (
            <div className="crz-luck-state crz-luck-state--small"><p>Ainda não tem jogada. Tá esperando o quê?</p></div>
          ) : (
            <div className="crz-luck-history__grid">
              {history.map((item) => (
                <article key={item.id}>
                  <div><small>{modeLabels[item.mode]}</small><strong>{item.prize_label}</strong><span>{formatDate(item.created_at)}</span></div>
                  <div><b>{Number(item.result?.chance_percent || 0).toFixed(2)}%</b>{item.result?.coupon_code && <code>{item.result.coupon_code}</code>}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
