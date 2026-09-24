"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NeonIcon, PageHeader } from "@/core/design-system";
import { useAuth } from "@/modules/auth/AuthProvider";
import type { LuckCampaign, LuckHistoryItem, LuckMode, LuckResult } from "./types";

const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(c)||0)/100);
const modeLabel:Record<LuckMode,string>={scratch:"Raspadinha PINK",wheel:"Roleta",drop:"Drop"};

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
 const labels=["Nada","Quase","Nada","Tente","Nada","Bônus?","Nada","Quase","Nada"];
 if(win)for(const i of pattern)labels[i]=result.prize_label;
 return labels.map((label,i)=>({label,win:win&&pattern.includes(i)}));
}

export function LuckPage(){
 const {user,loading:authLoading}=useAuth();
 const [campaigns,setCampaigns]=useState<LuckCampaign[]>([]),[history,setHistory]=useState<LuckHistoryItem[]>([]),[mode,setMode]=useState<LuckMode>("scratch"),[result,setResult]=useState<LuckResult|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[balance,setBalance]=useState(0),[revealAll,setRevealAll]=useState(false);
 const load=useCallback(async()=>{const [c,h,b]=await Promise.all([fetch("/api/luck?action=catalog",{cache:"no-store"}),user?fetch("/api/luck?action=history",{cache:"no-store"}):Promise.resolve(null),user?fetch("/api/bonus",{cache:"no-store"}):Promise.resolve(null)]);const cp=await c.json().catch(()=>({}));if(c.ok)setCampaigns(cp.campaigns||[]);if(h){const hp=await h.json().catch(()=>({}));if(h.ok)setHistory(hp.history||[])}if(b){const bp=await b.json().catch(()=>({}));if(b.ok)setBalance(Number(bp?.wallet?.balance_cents||0))}},[user]);
 useEffect(()=>{if(!authLoading)void load()},[authLoading,load]);
 const campaign=useMemo(()=>campaigns.find(c=>c.mode===mode)||campaigns[0]||null,[campaigns,mode]);
 useEffect(()=>{if(campaign&&campaign.mode!==mode)setMode(campaign.mode)},[campaign?.id]);
 const play=async()=>{if(!user){window.location.href="/login";return}if(!campaign||busy)return;setBusy(true);setNotice("");setResult(null);setRevealAll(false);const r=await fetch("/api/luck?action=play",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({campaignSlug:campaign.slug,idempotencyKey:"arcade:"+crypto.randomUUID()})});const p=await r.json().catch(()=>({}));setBusy(false);if(!r.ok){setNotice(p.error||"Não foi possível jogar.");return}setResult(p.result as LuckResult);setBalance(Number(p.result?.bonus_balance_cents||balance));void load()};
 const grid=result?buildGrid(result):[];
 return <main className="crz-luck-page"><div className="crz-container">
  <PageHeader eyebrow="CRAZZY ARCADE" title="Raspadinha, roleta e drops" description="Use somente CRAZZY BONUS promocional. O resultado é definido e registrado no servidor antes da animação." actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/bonus">Minha Carteira BONUS</a>}/>
  <section className="crz-arcade-wallet"><div><small>CRAZZY BONUS DISPONÍVEL</small><strong>{money(balance)}</strong></div><a href="/bonus">Ver extrato e regras →</a></section>
  <div className="crz-arcade-mode-tabs">{(["scratch","wheel","drop"] as LuckMode[]).map(m=><button key={m} className={mode===m?"is-active":""} onClick={()=>{setMode(m);setResult(null);setRevealAll(false);setNotice("")}}>{modeLabel[m]}</button>)}</div>
  {notice&&<div className="crz-luck-notice">{notice}</div>}
  {!campaign?<div className="crz-luck-rules"><NeonIcon name="shield" size={26}/><div><strong>CRAZZY ARCADE aguardando configuração</strong><span>O admin precisa definir o custo em CRAZZY BONUS antes de liberar uma campanha.</span></div></div>:<>
   {mode==="scratch"?<div className="crz-pink-scratch"><div className="crz-pink-card"><div className="crz-pink-grid">{result?grid.map((c,i)=><ScratchCell key={result.play_id+"-"+i} label={c.label} win={c.win} revealAll={revealAll}/>):Array.from({length:9},(_,i)=><div className="crz-pink-cell" key={i}><div className="crz-pink-cell__value">?</div></div>)}</div></div><aside className="crz-pink-side"><small>RASPADINHA PINK • MIGRADA</small><h3>{campaign.title}</h3><p>{campaign.description||"Raspe as nove casas. Três iguais formam o visual de vitória; o prêmio real já foi decidido no servidor."}</p><strong>Custo: {money(campaign.bonus_cost_cents)} BONUS</strong>{result?<><div><b>{result.prize_type==="none"?"Não foi dessa vez":result.prize_label}</b>{result.bonus_awarded_cents?<p>+ {money(result.bonus_awarded_cents)} CRAZZY BONUS</p>:null}{result.coupon_code?<p>Cupom: {result.coupon_code}</p>:null}</div><button className="is-secondary" onClick={()=>setRevealAll(true)}>Revelar tudo</button><button onClick={()=>void play()} disabled={busy}>{busy?"Gerando...":"Jogar novamente"}</button></>:<button onClick={()=>void play()} disabled={busy}>{busy?"Gerando...":"Gerar raspadinha • "+money(campaign.bonus_cost_cents)}</button>}</aside></div>:<section className="crz-luck-game-actions"><NeonIcon name={mode==="wheel"?"crown":"cube"} size={58}/><strong>{campaign.title}</strong><p>{campaign.description}</p><p>Custo: {money(campaign.bonus_cost_cents)} CRAZZY BONUS</p>{result&&<div className="crz-luck-result"><span>RESULTADO</span><strong>{result.prize_label}</strong></div>}<button className="crz-button crz-button--primary crz-button--lg" onClick={()=>void play()} disabled={busy}>{busy?"Processando...":mode==="wheel"?"Girar roleta":"Abrir drop"}</button></section>}
   <section className="crz-arcade-prizes"><header><strong>Prêmios desta campanha</strong><span>chances auditáveis</span></header><div>{campaign.prizes.map(p=><article key={p.id}><strong>{p.label}</strong><small>{Number(p.chance_percent).toFixed(2)}% • {p.prize_type}</small></article>)}</div></section>
  </>}
  {history.length>0&&<section className="crz-arcade-history"><h3>Histórico</h3>{history.slice(0,12).map(h=><div key={h.id}><span>{h.campaign_title} • {h.prize_label}</span><small>{new Date(h.created_at).toLocaleString("pt-BR")}</small></div>)}</section>}
 </div></main>
}
