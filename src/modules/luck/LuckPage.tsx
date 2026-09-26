"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NeonIcon, PageHeader } from "@/core/design-system";
import { useAuth } from "@/modules/auth/AuthProvider";
import type { LuckCampaign, LuckHistoryItem, LuckMode, LuckResult } from "./types";

const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(c)||0)/100);
const prizeColor=(index:number,count:number)=>`hsl(${Math.round(index*360/Math.max(1,count))} 78% 44%)`;
const modeLabel:Record<LuckMode,string>={scratch:"Raspadinha",wheel:"Roleta",drop:"Drop"};

function ScratchCell({label,win,revealAll}:{label:string;win:boolean;revealAll:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),drawing=useRef(false),strokes=useRef(0);
 const [revealed,setRevealed]=useState(false);
 useEffect(()=>{setRevealed(false);strokes.current=0;const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return;ctx.globalCompositeOperation="source-over";const g=ctx.createLinearGradient(0,0,c.width,c.height);g.addColorStop(0,"#ff2f9b");g.addColorStop(.5,"#7b144f");g.addColorStop(1,"#17121c");ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle="rgba(255,255,255,.86)";ctx.font="700 18px Arial";ctx.textAlign="center";ctx.fillText("RASPE",c.width/2,c.height/2+6)},[label]);
 useEffect(()=>{if(!revealAll)return;const c=canvas.current;c?.getContext("2d")?.clearRect(0,0,c.width,c.height);setRevealed(true)},[revealAll]);
 const scratch=(e:React.PointerEvent<HTMLCanvasElement>)=>{const c=canvas.current;if(!c)return;const r=c.getBoundingClientRect(),ctx=c.getContext("2d");if(!ctx)return;ctx.globalCompositeOperation="destination-out";ctx.beginPath();ctx.arc((e.clientX-r.left)*(c.width/r.width),(e.clientY-r.top)*(c.height/r.height),25,0,Math.PI*2);ctx.fill();strokes.current+=1;if(strokes.current>14){ctx.clearRect(0,0,c.width,c.height);setRevealed(true)}};
 return <div className="crz-pink-cell"><div className={"crz-pink-cell__value "+(win?"is-win":"")}>{win?"★ ":""}{label}</div>{!revealed&&<canvas ref={canvas} width={220} height={220} onPointerDown={e=>{drawing.current=true;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);scratch(e)}} onPointerMove={e=>drawing.current&&scratch(e)} onPointerUp={()=>drawing.current=false} onPointerCancel={()=>drawing.current=false}/>}</div>
}

function buildGrid(result:LuckResult){
 const win=result.prize_type!=="none",seed=[...result.play_id].reduce((a,c)=>a+c.charCodeAt(0),0),patterns=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]],pattern=patterns[seed%patterns.length];
 const labels=["Tente","Quase","Bônus?","Nada","Outra","De novo","Volte","Hoje não","Mais uma"];
 if(win)for(const i of pattern)labels[i]=result.prize_label;
 return labels.map((label,i)=>({label,win:win&&pattern.includes(i)}));
}

export function LuckPage(){
 const {user,loading:authLoading}=useAuth();
 const [campaigns,setCampaigns]=useState<LuckCampaign[]>([]),[history,setHistory]=useState<LuckHistoryItem[]>([]),[mode,setMode]=useState<LuckMode>("scratch"),[result,setResult]=useState<LuckResult|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[balance,setBalance]=useState(0),[revealAll,setRevealAll]=useState(false),[wheelRotation,setWheelRotation]=useState(0);
 const [activePrize,setActivePrize]=useState<string|null>(null);
 const spinFrame=useRef<number|null>(null);
 const [wheelSnapshot,setWheelSnapshot]=useState<LuckCampaign|null>(null);
 useEffect(()=>{const requested=new URLSearchParams(location.search).get("mode");if(["scratch","wheel","drop"].includes(requested||""))setMode(requested as LuckMode)},[]);
 const load=useCallback(async()=>{const [c,h,b]=await Promise.all([fetch("/api/luck?action=catalog",{cache:"no-store"}),user?fetch("/api/luck?action=history",{cache:"no-store"}):Promise.resolve(null),user?fetch("/api/bonus",{cache:"no-store"}):Promise.resolve(null)]);const cp=await c.json().catch(()=>({}));if(c.ok)setCampaigns(cp.campaigns||[]);if(h){const hp=await h.json().catch(()=>({}));if(h.ok)setHistory(hp.history||[])}if(b){const bp=await b.json().catch(()=>({}));if(b.ok)setBalance(Number(bp?.wallet?.balance_cents||0))}},[user]);
 useEffect(()=>{if(!authLoading)void load().catch(()=>setNotice("Não foi possível carregar seus prêmios."))},[authLoading,load]);
 const campaign=useMemo(()=>campaigns.find(c=>c.mode===mode)||null,[campaigns,mode]);
 useEffect(()=>{if(!busy&&!result&&campaign&&campaign.mode!==mode)setMode(campaign.mode)},[campaign?.id]);
 const playLock=useRef(false), spinTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(spinTimer.current)clearTimeout(spinTimer.current);if(spinFrame.current)cancelAnimationFrame(spinFrame.current)},[]);
 const finishPlay=()=>{playLock.current=false;setBusy(false);void load().catch(()=>setNotice("Atualize a página para consultar o histórico."))};
 const play=async()=>{
  if(!user){window.location.href="/login?next=/club/luck";return}
  if(!campaign||playLock.current)return;
  setWheelSnapshot(campaign.mode!=="scratch"?structuredClone(campaign):null);
  playLock.current=true;setBusy(true);setNotice("");setResult(null);setRevealAll(false);
  try{
   const r=await fetch("/api/luck?action=play",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({campaignSlug:campaign.slug,idempotencyKey:"arcade:"+crypto.randomUUID()})});
   const p=await r.json().catch(()=>({}));
   if(!r.ok||!p.result?.play_id){setNotice(p.error||"Não foi possível jogar.");finishPlay();return}
   const next=p.result as LuckResult;
   setBalance(Number(next.bonus_balance_cents??balance));
   if(campaign.mode!=="scratch"){
    const idx=campaign.prizes.findIndex(prize=>prize.id===next.prize_id);
    if(idx<0){setResult(next);setNotice("Prêmio registrado. Consulte o resultado abaixo.");finishPlay();return}
    const center=(idx+.5)*360/campaign.prizes.length;
    const target=(270-center+360)%360;
    const startRotation=wheelRotation, endRotation=Math.ceil(startRotation/360)*360+1440+target;
    const start=performance.now(), duration=window.matchMedia("(prefers-reduced-motion: reduce)").matches?0:4200;
    const animate=(now:number)=>{
      const progress=duration?Math.min(1,(now-start)/duration):1;
      const rotation=startRotation+(endRotation-startRotation)*(1-Math.pow(1-progress,4));
      setWheelRotation(rotation);
      const pointer=((270-rotation)%360+360)%360;
      setActivePrize(campaign.prizes[Math.floor(pointer/(360/campaign.prizes.length))]?.id||null);
      if(progress<1)spinFrame.current=requestAnimationFrame(animate);
      else{setActivePrize(next.prize_id);setResult(next);finishPlay();}
    };
    spinFrame.current=requestAnimationFrame(animate);
   }else{setResult(next);finishPlay()}
  }catch{setNotice("A conexão falhou. Consulte o histórico antes de tentar novamente.");finishPlay()}
 };

 const grid=result?buildGrid(result):[];
 const visualCampaign=mode!=="scratch"&&wheelSnapshot?wheelSnapshot:campaign;
 return <main className="crz-luck-page"><div className="crz-container">
  <PageHeader eyebrow="CRAZZY ARCADE" title="Raspadinha, roleta e drops" description="Drop diário grátis de descontos. Use seu BONUS na roleta e na raspadinha de produtos." actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/bonus">Minha Carteira BONUS</a>}/>
  <section className="crz-arcade-wallet"><div><small>CRAZZY BONUS DISPONÍVEL</small><strong>{money(balance)}</strong></div><a href="/bonus">Ver extrato e regras →</a></section>
  <div className="crz-arcade-mode-tabs">{(["scratch","wheel","drop"] as LuckMode[]).map(m=><button key={m} disabled={busy} className={mode===m?"is-active":""} onClick={()=>{setMode(m);setActivePrize(null);setWheelSnapshot(null);setResult(null);setRevealAll(false);setNotice("")}}>{modeLabel[m]}</button>)}</div>
  {notice&&<div className="crz-luck-notice">{notice}</div>}
  {visualCampaign&&visualCampaign.prizes.length===0&&<p className="crz-luck-notice">Esta campanha ainda não tem prêmios disponíveis. Confira o drop gratuito enquanto isso.</p>}
  {!visualCampaign?<div className="crz-luck-rules"><NeonIcon name="shield" size={26}/><div><strong>Novidades em breve</strong><span>Novos prêmios chegam em breve. Volte para conferir!</span></div></div>:<>
   {mode==="scratch"?<div className="crz-pink-scratch"><div className="crz-pink-card"><div className="crz-pink-grid">{result?grid.map((c,i)=><ScratchCell key={result.play_id+"-"+i} label={c.label} win={c.win} revealAll={revealAll}/>):Array.from({length:9},(_,i)=><div className="crz-pink-cell" key={i}><div className="crz-pink-cell__value">?</div></div>)}</div></div><aside className="crz-pink-side"><small>CRAZZY SCRATCH</small><h3>{visualCampaign.title}</h3><p>{visualCampaign.description||"Raspe as nove casas e descubra o resultado da sua rodada."}</p><strong>Custo: {money(visualCampaign.bonus_cost_cents)} BONUS</strong>{result?<><div><b>{result.prize_type==="none"?"Não foi dessa vez":result.prize_label}</b>{result.bonus_awarded_cents?<p>+ {money(result.bonus_awarded_cents)} CRAZZY BONUS</p>:null}{result.coupon_code?<p>Cupom: {result.coupon_code}</p>:null}</div><button className="is-secondary" onClick={()=>setRevealAll(true)}>Revelar tudo</button><button onClick={()=>void play()} disabled={busy||!visualCampaign.prizes.length}>{busy?"Gerando...":"Jogar novamente"}</button></>:<button onClick={()=>void play()} disabled={busy||!visualCampaign.prizes.length}>{busy?"Gerando...":"Gerar raspadinha • "+money(visualCampaign.bonus_cost_cents)}</button>}</aside></div>:<section className="crz-luck-wheel-layout"><div className="crz-luck-wheel-wrap"><span className="crz-luck-wheel-pointer" aria-hidden="true">▶</span><div className="crz-luck-wheel" style={{transform:`rotate(${wheelRotation}deg)`,transition:"none",background:`conic-gradient(${visualCampaign.prizes.map((_,i)=>{const step=360/visualCampaign.prizes.length,start=i*step,end=(i+1)*step,color=prizeColor(i,visualCampaign.prizes.length);return `#fff ${start}deg ${start+.65}deg, ${color} ${start+.65}deg ${end-.65}deg, #fff ${end-.65}deg ${end}deg`}).join(",")})`}}>{visualCampaign.prizes.map((prize,i)=>{const angle=(i+.5)*360/visualCampaign.prizes.length;return <span className="crz-luck-wheel__label" key={prize.id} style={{transform:`translate(-50%,-50%) rotate(${angle}deg)`}}>{prize.label}</span>})}<div className="crz-luck-wheel__hub"><strong>CRAZZY</strong><span>LUCK</span></div></div></div><div className="crz-luck-game-actions"><strong>{visualCampaign.title}</strong><p>{visualCampaign.description}</p><p>{mode==="drop"?"GRÁTIS · uma vez por dia":"Custo: "+money(visualCampaign.bonus_cost_cents)+" CRAZZY BONUS"}</p>{result&&<div className="crz-luck-result"><span>PRÊMIO</span><strong>{result.prize_label}</strong></div>}<button className="crz-button crz-button--primary crz-button--lg" onClick={()=>void play()} disabled={busy||!visualCampaign.prizes.length}>{busy?"Girando...":mode==="drop"?"GIRAR GRÁTIS":"GIRAR"}</button></div></section>}
   <section className="crz-arcade-prizes"><header><strong>Prêmios desta campanha</strong><span>chances auditáveis</span></header><div>{visualCampaign.prizes.map((p,i)=><article key={p.id} className={activePrize===p.id?"is-tracking":""} style={{borderColor:prizeColor(i,visualCampaign.prizes.length),boxShadow:activePrize===p.id?`0 0 0 2px ${prizeColor(i,visualCampaign.prizes.length)}`:undefined}}><i aria-hidden="true" style={{background:prizeColor(i,visualCampaign.prizes.length)}}/><strong>{p.label}</strong><small>{Number(p.chance_percent).toFixed(2)}%</small></article>)}</div></section>
  </>}
  {result?.coupon_code&&<div className="crz-luck-result"><span>SEU CUPOM</span><strong>{result.coupon_code}</strong><a href="/painel/cupons">Ver meus cupons</a></div>}
  {result?.prize_type==="product"&&<div className="crz-luck-result"><strong>Produto entregue!</strong><a href="/painel/biblioteca">Abrir key e produto</a><a href="/academy">Acessar tutorial</a></div>}
  {history.length>0&&<section className="crz-arcade-history"><h3>Histórico</h3>{history.slice(0,12).map(h=><div key={h.id}><span>{h.campaign_title} • {h.prize_label}</span><small>{new Date(h.created_at).toLocaleString("pt-BR")}</small></div>)}</section>}
 </div></main>
}
