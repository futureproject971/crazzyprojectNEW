"use client";

import {useEffect,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";
import type {MyResellerSnapshot} from "./types";

function money(value:number){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value)||0)}
function date(value:string|null){if(!value)return"Sem validade";const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("pt-BR")}

export function ResellerHubPage(){
  const [data,setData]=useState<MyResellerSnapshot|null>(null);
  const [state,setState]=useState<"loading"|"ready"|"error">("loading");

  useEffect(()=>{void(async()=>{
    try{
      const r=await fetch("/api/reseller",{cache:"no-store"});
      const p=await r.json();
      if(!r.ok)throw new Error();
      setData(p);setState("ready");
    }catch{setState("error")}
  })()},[]);

  if(state==="loading")return <main className="crz-resellers-state"><span className="crz-spinner"/><strong>Carregando área reseller...</strong></main>;
  if(state==="error"||!data)return <main className="crz-resellers-state"><strong>Área de revendedor indisponível.</strong></main>;
  if(!data.reseller)return <main className="crz-resellers-state"><strong>Sua conta ainda não participa do programa de revendedores.</strong><a href="/tickets/novo">Falar com suporte</a></main>;

  const r=data.reseller;
  return <main className="crz-resellerhub"><div className="crz-container crz-resellerhub__container">
    <PageHeader eyebrow="CRAZZY • RESELLER HUB" title="Seu catálogo de revenda" description="Valores e produtos liberados para a sua conta." actions={<Badge tone={r.eligible?"green":"gold"}>{r.eligible?"ATIVO":"INDISPONÍVEL"}</Badge>}/>
    <section className="crz-resellerhub-stats">
      <article><small>DESCONTO</small><strong>{r.discount_percent}%</strong><span>sobre preço público</span></article>
      <article><small>VALIDADE</small><strong>{date(r.expires_at)}</strong><span>programa reseller</span></article>
      <article><small>COMPRAS</small><strong>{r.total_purchases}</strong><span>registradas</span></article>
      <article><small>PLANOS</small><strong>{data.products.length}</strong><span>liberados</span></article>
    </section>
    <section className="crz-resellerhub-grid">{data.products.map(item=><article key={item.plan_id}>
      <div>{item.image_url?<img src={item.image_url} alt=""/>:<span>CRAZZY</span>}</div>
      <small>{item.status_label}</small><h2>{item.product_name}</h2><p>{item.plan_name}</p>
      <dl><dt>Público</dt><dd>{money(item.public_price)}</dd><dt>Revendedor</dt><dd>{money(item.reseller_price)}</dd></dl>
      <a href={"/produto/"+item.slug}>Ver produto →</a>
    </article>)}</section>
    {!data.products.length&&<div className="crz-resellers-empty">Nenhum produto está liberado para sua conta ainda.</div>}
    <section className="crz-resellerhub-history"><header><strong>Histórico reseller</strong></header>{data.purchases.map(item=><div key={item.id}><span><strong>{item.product_name}</strong><small>{item.plan_name} • {new Date(item.created_at).toLocaleDateString("pt-BR")}</small></span><b>{money(item.paid_price)}</b></div>)}{!data.purchases.length&&<em>Nenhuma compra reseller registrada ainda.</em>}</section>
  </div></main>;
}
