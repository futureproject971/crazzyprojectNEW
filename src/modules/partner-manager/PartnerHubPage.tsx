"use client";
import {useEffect,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";
const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(c)||0)/100);
export function PartnerHubPage(){
  const [data,setData]=useState<any>(null),[state,setState]=useState<"loading"|"ready"|"error">("loading");
  useEffect(()=>{void fetch("/api/partner",{cache:"no-store"}).then(async r=>{const p=await r.json();if(!r.ok)throw new Error();setData(p);setState("ready")}).catch(()=>setState("error"))},[]);
  if(state==="loading")return <main className="crz-partner-state"><span className="crz-spinner"/></main>;
  if(state==="error"||!data?.partner)return <main className="crz-partner-state">Sua conta ainda não está cadastrada como parceiro.</main>;
  return <main className="crz-partner"><div className="crz-container">
    <PageHeader eyebrow="PARTNER HUB" title={data.partner.display_name} description={"Seu link: /mtsounds?via="+data.partner.code} actions={<Badge tone={data.partner.active?"green":"neutral"}>{data.partner.active?"ATIVO":"PAUSADO"}</Badge>}/>
    <section className="crz-partner-stats"><article><small>PENDENTE</small><strong>{money(data.totals?.pending_cents)}</strong></article><article><small>DISPONÍVEL</small><strong>{money(data.totals?.available_cents)}</strong></article><article><small>PAGO</small><strong>{money(data.totals?.paid_cents)}</strong></article></section>
    <section className="crz-partner-sales">{(data.commissions||[]).map((c:any)=><article key={c.id}><div><strong>{money(c.commission_amount_cents)}</strong><small>Venda {money(c.eligible_amount_cents)} • {c.commission_percent}%</small></div><Badge tone={c.status==="available"?"green":c.status==="reversed"?"pink":c.status==="paid"?"blue":"gold"}>{c.status.toUpperCase()}</Badge></article>)}{!data.commissions?.length&&<div className="crz-partner-empty">Nenhuma comissão ainda.</div>}</section>
  </div></main>;
}
