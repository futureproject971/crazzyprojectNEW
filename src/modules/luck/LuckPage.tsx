"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NeonIcon, PageHeader } from "@/core/design-system";
import { useAuth } from "@/modules/auth/AuthProvider";
import type { CheckoutConfig, CheckoutCreateResponse, CheckoutMethod } from "@/modules/checkout/types";
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

function formatMoneyCents(value:number){
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(value)||0)/100);
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
      {result.delivery_status === "pending" && <em>Prêmio em preparação para entrega.</em>}
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
            <strong>Uma jogada. Um resultado do servidor.</strong>
            <p>A animação só revela o prêmio que já foi sorteado e registrado com segurança.</p>
          </>
        )}
        <button type="button" className="crz-button crz-button--primary crz-button--lg" disabled={spinning} onClick={onPlay}>
          {spinning ? "Girando..." : "Girar roleta"}
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
            <div><NeonIcon name="crown" size={52} /><strong>CRAZZY SCRATCH</strong><span>Gere sua raspadinha para começar</span></div>
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
        <strong>{result ? "Raspe a camada para revelar." : "Sua raspadinha diária espera por você."}</strong>
        <p>O prêmio é registrado antes da raspagem. Alterar o visual no navegador não altera o resultado.</p>
        {!result && (
          <button type="button" className="crz-button crz-button--primary crz-button--lg" disabled={busy} onClick={onPlay}>
            {busy ? "Gerando..." : "Gerar raspadinha"}
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
            <strong>Abra seu drop do dia.</strong>
            <p>O servidor escolhe e registra o prêmio antes da caixa abrir.</p>
          </>
        )}
        <button type="button" className="crz-button crz-button--primary crz-button--lg" disabled={busy || opening} onClick={onPlay}>
          {opening ? "Abrindo..." : result ? "Drop aberto" : "Abrir drop"}
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
  const [checkoutConfig,setCheckoutConfig]=useState<CheckoutConfig|null>(null);
  const [paidRequired,setPaidRequired]=useState(false);
  const [paidMethod,setPaidMethod]=useState<Extract<CheckoutMethod,"pix"|"crypto">>("pix");
  const [paidPaymentId,setPaidPaymentId]=useState<string|null>(null);
  const [paidPayment,setPaidPayment]=useState<CheckoutCreateResponse|null>(null);
  const [paidStatus,setPaidStatus]=useState<string|null>(null);
  const [paidBusy,setPaidBusy]=useState(false);
  const paidAttemptKey=useRef<string|null>(null);
  const paidPlayTriggered=useRef(false);

  const loadCatalog = useCallback(async () => {
    const response = await fetch("/api/luck?action=catalog", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setCampaigns(payload.campaigns || []);
    else setNotice(payload?.error || "Não foi possível carregar o CRAZZY LUCK.");
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
    Promise.all([
      loadCatalog(),
      user ? loadHistory() : Promise.resolve(),
      fetch("/api/checkout/config",{cache:"no-store"})
        .then(async r=>r.ok?(await r.json() as CheckoutConfig):null)
        .then(setCheckoutConfig)
        .catch(()=>setCheckoutConfig(null)),
    ]).finally(() => setLoading(false));
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
    setPaidRequired(false);
    setPaidPaymentId(null);
    setPaidPayment(null);
    setPaidStatus(null);
    paidAttemptKey.current=null;
    paidPlayTriggered.current=false;
  };

  const paymentStorageKey=(slug:string)=>"crz:luck-payment:"+slug;

  const clearPaidPayment=()=>{
    if(campaign && typeof window!=="undefined")sessionStorage.removeItem(paymentStorageKey(campaign.slug));
    setPaidPaymentId(null);
    setPaidPayment(null);
    setPaidStatus(null);
    setPaidRequired(false);
    paidAttemptKey.current=null;
    paidPlayTriggered.current=false;
  };

  const play = async (paymentId?:string) => {
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
        paymentId: paymentId || null,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setBusy(false);
      setSpinning(false);
      setOpening(false);
      if(response.status===402 && campaign.play_price_cents>0){
        setPaidRequired(true);
        setNotice("Sua jogada grátis já foi usada. Você pode comprar uma jogada extra com pagamento vinculado a esta campanha.");
      }else{
        setNotice(payload?.error || "Não foi possível jogar agora.");
      }
      return;
    }

    const next = payload.result as LuckResult;
    if(paymentId)clearPaidPayment();

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


  const enabledPaidMethods=(checkoutConfig?.methods||[])
    .filter(item=>item.enabled&&(item.method==="pix"||item.method==="crypto"))
    .map(item=>item.method as Extract<CheckoutMethod,"pix"|"crypto">);

  const startPaidPlay=async()=>{
    if(!campaign||paidBusy||campaign.play_price_cents<=0)return;
    if(!checkoutConfig?.ready||!enabledPaidMethods.includes(paidMethod)){
      setNotice("Pagamento para jogada extra está indisponível neste método.");
      return;
    }
    if(!paidAttemptKey.current)paidAttemptKey.current="luck:"+campaign.slug+":"+createIdempotencyKey();
    setPaidBusy(true);
    setNotice(null);
    try{
      const response=await fetch("/api/checkout/create",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          method:paidMethod,
          cart_snapshot:[{type:"luck-play",campaignSlug:campaign.slug,quantity:1}],
          coupon_code:null,
          idempotency_key:paidAttemptKey.current,
        }),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload?.error||"Não foi possível gerar o pagamento.");
      const created=payload as CheckoutCreateResponse;
      setPaidPayment(created);
      setPaidPaymentId(created.payment_id);
      setPaidStatus("ACTIVE");
      paidPlayTriggered.current=false;
      sessionStorage.setItem(paymentStorageKey(campaign.slug),JSON.stringify({paymentId:created.payment_id,method:paidMethod}));
    }catch(error){
      setNotice(error instanceof Error?error.message:"Não foi possível gerar o pagamento.");
    }finally{
      setPaidBusy(false);
    }
  };

  useEffect(()=>{
    if(!campaign||!user||paidPaymentId)return;
    try{
      const raw=sessionStorage.getItem(paymentStorageKey(campaign.slug));
      if(!raw)return;
      const saved=JSON.parse(raw);
      if(typeof saved?.paymentId==="string"&&(saved?.method==="pix"||saved?.method==="crypto")){
        setPaidPaymentId(saved.paymentId);
        setPaidMethod(saved.method);
        setPaidStatus("ACTIVE");
        setPaidRequired(true);
      }
    }catch{
      sessionStorage.removeItem(paymentStorageKey(campaign.slug));
    }
  },[campaign?.slug,user,paidPaymentId]);

  useEffect(()=>{
    if(!campaign||!paidPaymentId||!user||!["pix","crypto"].includes(paidMethod))return;
    if(["COMPLETED","FAILED","EXPIRED","CANCELLED"].includes(String(paidStatus||"")))return;

    let stopped=false;
    const check=async()=>{
      const response=await fetch(
        "/api/checkout/status?payment_id="+encodeURIComponent(paidPaymentId)+"&method="+encodeURIComponent(paidMethod),
        {cache:"no-store"}
      );
      const payload=await response.json().catch(()=>null);
      if(stopped||!response.ok||!payload?.status)return;
      const nextStatus=String(payload.status);
      setPaidStatus(nextStatus);
      if(nextStatus==="COMPLETED"&&!paidPlayTriggered.current){
        paidPlayTriggered.current=true;
        sessionStorage.removeItem(paymentStorageKey(campaign.slug));
        await play(paidPaymentId);
      }else if(["FAILED","EXPIRED","CANCELLED"].includes(nextStatus)){
        paidAttemptKey.current=null;
        sessionStorage.removeItem(paymentStorageKey(campaign.slug));
        setNotice("A cobrança da jogada expirou ou falhou. Você pode gerar uma nova.");
      }
    };
    void check();
    const timer=window.setInterval(()=>void check(),3500);
    return()=>{stopped=true;window.clearInterval(timer)};
  },[campaign?.slug,paidPaymentId,paidMethod,paidStatus,user]);

  return (
    <main className="crz-luck-page">
      <div className="crz-container">
        <PageHeader
          eyebrow="CRAZZY LUCK"
          title="Roleta, raspadinha e drops"
          description="Prêmios reais com resultado definido no servidor e chances exibidas com transparência."
          actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/club">Voltar ao CLUB</a>}
        />

        <div className="crz-luck-rules">
          <NeonIcon name="shield" size={28} />
          <div>
            <strong>1 jogada grátis diária compartilhada entre os modos</strong>
            <span>Escolha Roleta, Raspadinha ou Drop. O prêmio e o log são criados no servidor.</span>
          </div>
        </div>

        {notice && <div className="crz-luck-notice">{notice}</div>}

        {campaign&&paidRequired&&campaign.play_price_cents>0&&(
          <section className="crz-luck-payment">
            <header><div><small>JOGADA EXTRA</small><strong>{formatMoneyCents(campaign.play_price_cents)}</strong></div><span>{paidStatus||"AGUARDANDO COBRANÇA"}</span></header>
            {!paidPaymentId&&<>
              <p>O valor é recalculado no servidor e o pagamento só vale para <b>{campaign.title}</b>. Cupom, revenda e pedidos comuns não viram crédito de Luck.</p>
              <div className="crz-luck-payment__methods">
                {(["pix","crypto"] as const).map(method=>{
                  const enabled=Boolean(checkoutConfig?.ready&&enabledPaidMethods.includes(method));
                  return <button type="button" key={method} disabled={!enabled||paidBusy} className={paidMethod===method?"is-active":""} onClick={()=>setPaidMethod(method)}>{method==="pix"?"PIX":"Litecoin"}<small>{enabled?"Disponível":"Indisponível"}</small></button>
                })}
              </div>
              <button type="button" className="crz-button crz-button--primary crz-button--md" disabled={paidBusy||!enabledPaidMethods.includes(paidMethod)} onClick={()=>void startPaidPlay()}>{paidBusy?"Gerando...":"Gerar pagamento da jogada"}</button>
            </>}
            {paidPaymentId&&<>
              {paidPayment?.charge?.qrCodeImage&&<img className="crz-luck-payment__qr" src={paidPayment.charge.qrCodeImage} alt="QR Code PIX"/>}
              {paidPayment?.charge?.brCode&&<label><span>PIX copia e cola</span><textarea readOnly value={paidPayment.charge.brCode}/><button type="button" onClick={()=>navigator.clipboard?.writeText(paidPayment.charge?.brCode||"")}>Copiar PIX</button></label>}
              {paidPayment?.crypto&&<label><span>Envie exatamente {paidPayment.crypto.payAmount} LTC</span><textarea readOnly value={paidPayment.crypto.address}/><button type="button" onClick={()=>navigator.clipboard?.writeText(paidPayment.crypto?.address||"")}>Copiar endereço</button></label>}
              {!paidPayment&&<p>Cobrança recuperada. Conferindo confirmação automaticamente...</p>}
              <small>Pagamento ID {paidPaymentId.slice(0,8)} • ao confirmar, a jogada acontece automaticamente.</small>
              {["FAILED","EXPIRED","CANCELLED"].includes(String(paidStatus||""))&&<button type="button" className="crz-button crz-button--secondary crz-button--sm" onClick={clearPaidPayment}>Gerar outra cobrança</button>}
            </>}
          </section>
        )}

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
              <div className="crz-luck-state"><span className="crz-spinner" /><p>Carregando campanhas...</p></div>
            ) : !campaign ? (
              <div className="crz-luck-state"><NeonIcon name="crown" size={40} /><strong>Modo indisponível</strong><p>Esta campanha está pausada no momento.</p></div>
            ) : mode === "wheel" ? (
              <WheelGame campaign={campaign} result={result} spinning={spinning} rotation={rotation} onPlay={() => void play()} />
            ) : mode === "scratch" ? (
              <ScratchGame result={result} busy={busy} onPlay={() => void play()} />
            ) : (
              <DropGame result={result} busy={busy} opening={opening} onPlay={() => void play()} />
            )}
          </div>

          <aside className="crz-luck-odds">
            <header><span>CHANCES REAIS</span><h2>{campaign?.title || "Prêmios"}</h2></header>
            <p>As porcentagens abaixo são calculadas pelos pesos ativos da campanha no servidor.</p>
            <div className="crz-luck-odds__list">
              {(campaign?.prizes || []).map((prize, index) => (
                <div key={prize.id}>
                  <i style={{ background: palette[index % palette.length] }} />
                  <span>{prize.label}<small>{prize.prize_type === "coupon" ? "Cupom" : prize.prize_type}</small></span>
                  <strong>{Number(prize.chance_percent).toFixed(2)}%</strong>
                </div>
              ))}
            </div>
            {!authLoading && !user && <a className="crz-button crz-button--primary crz-button--md" href="/login">Entrar para jogar</a>}
          </aside>
        </section>

        <section className="crz-luck-history">
          <header><div><span>SEU HISTÓRICO</span><h2>Jogadas e prêmios</h2></div><button type="button" onClick={() => void loadHistory()}>Atualizar</button></header>
          {!user ? (
            <div className="crz-luck-state crz-luck-state--small"><p>Entre para ver suas jogadas.</p></div>
          ) : !history.length ? (
            <div className="crz-luck-state crz-luck-state--small"><p>Nenhuma jogada registrada ainda.</p></div>
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
