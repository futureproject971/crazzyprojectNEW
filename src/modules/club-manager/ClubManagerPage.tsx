"use client";

import { useEffect, useState } from "react";
import { Badge, NeonIcon, PageHeader } from "@/core/design-system";

type Snapshot = {
  rewards:{campaigns:number;activeCampaigns:number;sessions:number;pending:number;deliveries:number};
  luck:{campaigns:number;activeCampaigns:number;plays:number;awards:number;pendingAwards:number};
  coupons:{total:number;active:number;uses:number};
  rank:{tiers:number};
};

export function ClubManagerPage(){
  const [data,setData]=useState<Snapshot|null>(null);
  const [state,setState]=useState<"loading"|"ready"|"error">("loading");
  const load=async()=>{try{const r=await fetch("/api/admin/club",{cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error();setData(p);setState("ready")}catch{setState("error")}};
  useEffect(()=>{void load()},[]);
  if(state==="loading")return <main className="crz-clubmanager-state"><span className="crz-spinner"/><strong>Carregando CRAZZY CLUB...</strong></main>;
  if(state==="error"||!data)return <main className="crz-clubmanager-state"><strong>Club Manager indisponível.</strong><button type="button" onClick={()=>void load()}>Tentar novamente</button></main>;

  const modules=[
    {title:"Reward Manager",href:"/admin/rewards",icon:"crown" as const,badge:data.rewards.activeCampaigns+" ativa(s)",main:data.rewards.sessions+" sessões",sub:data.rewards.pending+" aguardando ação",alert:data.rewards.pending>0},
    {title:"Luck Manager",href:"/admin/luck",icon:"lightning" as const,badge:data.luck.activeCampaigns+" ativa(s)",main:data.luck.plays+" jogadas",sub:data.luck.pendingAwards+" prêmio(s) pendentes",alert:data.luck.pendingAwards>0},
    {title:"Coupon Manager",href:"/admin/cupons",icon:"featured" as const,badge:data.coupons.active+" ativo(s)",main:data.coupons.uses+" usos",sub:data.coupons.total+" cupons cadastrados",alert:false},
    {title:"CRAZZY Rank",href:"/club/rank",icon:"community" as const,badge:data.rank.tiers+" tiers",main:"Progressão",sub:"badges e pontos",alert:false},
  ];
  return <main className="crz-clubmanager"><div className="crz-container">
    <PageHeader eyebrow="M35 • CLUB MANAGER" title="O cérebro do CRAZZY CLUB" description="Rewards, Luck, Coupons e Rank vistos como um único sistema de retenção." actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/club">Abrir CLUB</a>}/>
    <section className="crz-clubmanager-grid">{modules.map(item=><a href={item.href} key={item.title} className={item.alert?"has-alert":""}><NeonIcon name={item.icon} size={38}/><div><span><small>MÓDULO</small><Badge tone={item.alert?"gold":"blue"}>{item.badge}</Badge></span><h2>{item.title}</h2><strong>{item.main}</strong><p>{item.sub}</p></div><b>→</b></a>)}</section>
    <section className="crz-clubmanager-health"><article><small>REWARD DELIVERIES</small><strong>{data.rewards.deliveries}</strong></article><article><small>LUCK AWARDS</small><strong>{data.luck.awards}</strong></article><article><small>CUPONS ATIVOS</small><strong>{data.coupons.active}</strong></article><article><small>RANK TIERS</small><strong>{data.rank.tiers}</strong></article></section>
  </div></main>
}
