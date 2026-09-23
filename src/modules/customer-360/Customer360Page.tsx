"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, PageHeader } from "@/core/design-system";
import type { Customer360Row, Customer360Snapshot } from "./types";

function money(cents:number){
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(cents)||0)/100);
}
function dateTime(value:string|null|undefined){
  if(!value)return"—";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"—":date.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
}
function short(value:string|null|undefined,size=12){
  const text=String(value||"");
  if(!text)return"—";
  return text.length>size+5?text.slice(0,size)+"…"+text.slice(-4):text;
}
function tone(status:string):"green"|"blue"|"pink"|"gold"|"neutral"{
  if(["COMPLETED","active","available","granted","resolved","closed"].includes(status))return"green";
  if(["ACTIVE","FULFILLING","open","waiting_staff","waiting_user","pending"].includes(status))return"blue";
  if(["FAILED","revoked","refunded","disputed","urgent"].includes(status))return"pink";
  if(["EXPIRED","expired","high"].includes(status))return"gold";
  return"neutral";
}

export function Customer360Page(){
  const searchParams=useSearchParams();
  const [customers,setCustomers]=useState<Customer360Row[]>([]);
  const [selected,setSelected]=useState<Customer360Row|null>(null);
  const [detail,setDetail]=useState<Customer360Snapshot|null>(null);
  const [query,setQuery]=useState("");
  const [state,setState]=useState<"loading"|"ready"|"auth"|"forbidden"|"error">("loading");
  const [detailLoading,setDetailLoading]=useState(false);
  const [notice,setNotice]=useState("");

  const load=useCallback(async(q=query)=>{
    try{
      const params=new URLSearchParams();
      if(q.trim())params.set("q",q.trim());
      params.set("limit","80");
      const response=await fetch("/api/admin/customers?"+params.toString(),{cache:"no-store"});
      if(response.status===401)return setState("auth");
      if(response.status===403)return setState("forbidden");
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!Array.isArray(payload.customers))throw new Error();
      setCustomers(payload.customers as Customer360Row[]);
      setState("ready");
    }catch{setState("error")}
  },[query]);

  const loadDetail=useCallback(async(customer:Customer360Row|{user_id:string})=>{
    setDetail(null);
    setDetailLoading(true);
    setNotice("");
    try{
      const response=await fetch("/api/admin/customers?userId="+encodeURIComponent(customer.user_id),{cache:"no-store"});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!payload.customer)throw new Error();
      setDetail(payload.customer as Customer360Snapshot);
      if("username" in customer)setSelected(customer as Customer360Row);
    }catch{setNotice("Não foi possível carregar a visão completa deste cliente.")}
    finally{setDetailLoading(false)}
  },[]);

  useEffect(()=>{
    const userId=searchParams.get("userId");
    if(userId&&/^[0-9a-f-]{36}$/i.test(userId)){
      setState("ready");
      void loadDetail({user_id:userId});
    }else{
      void load("");
    }
  },[]);

  const rows=useMemo(()=>customers,[customers]);

  if(state==="loading")return <main className="crz-customer360-state"><span className="crz-spinner"/><strong>Carregando clientes...</strong></main>;
  if(state==="auth")return <main className="crz-customer360-state"><strong>Entre para continuar.</strong><a href="/login?next=%2Fadmin%2Fclientes">Entrar</a></main>;
  if(state==="forbidden")return <main className="crz-customer360-state"><strong>Acesso de administrador necessário.</strong></main>;
  if(state==="error")return <main className="crz-customer360-state"><strong>Customer 360 indisponível.</strong><button onClick={()=>void load()}>Tentar novamente</button></main>;

  return <main className="crz-customer360"><div className="crz-container crz-customer360__container">
    <PageHeader eyebrow="M31 • CUSTOMER 360" title="Cada cliente, uma linha do tempo" description="Conta, Discord, pagamentos, produtos, entregas, tickets e cargos num único lugar." actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/admin">Control Center</a>}/>

    <section className="crz-customer360-toolbar">
      <label><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void load()}} placeholder="Nome, e-mail, Discord ID, username ou UUID..."/></label>
      <button className="crz-button crz-button--primary crz-button--sm" onClick={()=>void load()}>Buscar</button>
    </section>

    {notice&&<div className="crz-customer360-notice">{notice}</div>}

    <div className="crz-customer360-layout">
      <section className="crz-customer360-list">
        <header className="crz-customer360-row crz-customer360-row--head"><span>Cliente</span><span>Discord</span><span>Compras</span><span>Ativos</span><span>Tickets</span><span>Valor pago</span></header>
        {rows.map(customer=><button key={customer.user_id} className={"crz-customer360-row crz-customer360-row--item"+(selected?.user_id===customer.user_id?" is-selected":"")} onClick={()=>void loadDetail(customer)}>
          <span><strong>{customer.username||customer.email||short(customer.user_id)}</strong><small>{customer.email||short(customer.user_id)}</small></span>
          <span><strong>{customer.discord_global_name||customer.discord_username||"Não conectado"}</strong><small>{customer.guild_member?"✓ no servidor":customer.discord_user_id?"fora do servidor":"sem Discord"}</small></span>
          <span><strong>{customer.completed_payment_count}</strong><small>{customer.payment_count} tentativa(s)</small></span>
          <span><strong>{customer.active_entitlements}</strong><small>entitlement(s)</small></span>
          <span><strong>{customer.open_tickets}</strong><small>aberto(s)</small></span>
          <span><strong>{money(customer.paid_total_cents)}</strong><small>{customer.banned?"BLOQUEADO":customer.roles.join(", ")||"cliente"}</small></span>
        </button>)}
        {!rows.length&&<div className="crz-customer360-empty">Nenhum cliente encontrado.</div>}
      </section>

      <aside className="crz-customer360-detail">
        {detailLoading?<div className="crz-customer360-empty"><span className="crz-spinner"/><span>Carregando histórico...</span></div>:!detail?<div className="crz-customer360-empty"><strong>Selecione um cliente</strong><span>A visão 360 aparece aqui.</span></div>:<>
          <header className="crz-customer360-detail__head">
            <div><small>CLIENTE</small><h2>{detail.account.username||detail.account.email||short(detail.account.user_id)}</h2><span>{detail.account.email||"sem e-mail"} • desde {dateTime(detail.account.created_at)}</span></div>
            <Badge tone={detail.account.banned?"pink":"green"}>{detail.account.banned?"BLOQUEADO":"ATIVO"}</Badge>
          </header>

          <section className="crz-customer360-cards">
            <article><small>PAGO</small><strong>{money(detail.stats.paid_total_cents)}</strong><span>{detail.stats.completed_payment_count} compra(s)</span></article>
            <article><small>ATIVOS</small><strong>{detail.stats.active_entitlements}</strong><span>produtos</span></article>
            <article><small>ENTREGAS</small><strong>{detail.stats.deliveries}</strong><span>biblioteca</span></article>
            <article><small>TICKETS</small><strong>{detail.stats.open_tickets}</strong><span>abertos</span></article>
          </section>

          <section className="crz-customer360-block">
            <header><strong>Discord</strong><span>{detail.discord?.guild_member?"✓ membro verificado":detail.discord?"conectado, fora da guild":"não conectado"}</span></header>
            <div className="crz-customer360-kv">
              <span><small>Usuário</small><strong>{detail.discord?.global_name||detail.discord?.username||"—"}</strong></span>
              <span><small>Discord ID</small><strong>{detail.discord?.discord_user_id||"—"}</strong></span>
              <span><small>Última verificação</small><strong>{dateTime(detail.discord?.last_checked_at)}</strong></span>
              <span><small>Roles CRAZZY</small><strong>{detail.roles.join(", ")||"cliente"}</strong></span>
            </div>
          </section>

          <section className="crz-customer360-block">
            <header><strong>Pagamentos recentes</strong><span>{detail.payments.length}</span></header>
            <div className="crz-customer360-stack">{detail.payments.slice(0,8).map((item:any)=><a key={item.id} href={"/admin/pagamentos?paymentId="+encodeURIComponent(item.id)}><span><strong>{short(item.charge_id||item.id)}</strong><small>{dateTime(item.created_at)} • {(item.payment_method||"—").toUpperCase()}</small></span><span><Badge tone={tone(item.status)}>{item.status}</Badge><b>{money(item.amount)}</b></span></a>)}</div>
          </section>

          <section className="crz-customer360-block">
            <header><strong>Produtos e acessos</strong><span>{detail.entitlements.length}</span></header>
            <div className="crz-customer360-stack">{detail.entitlements.slice(0,10).map((item:any)=><div key={item.id}><span><strong>{item.product_name}</strong><small>{item.plan_name||item.plan_code||"plano"} • expira {dateTime(item.expires_at)}</small></span><Badge tone={tone(item.status)}>{item.status}</Badge></div>)}</div>
          </section>

          <section className="crz-customer360-block">
            <header><strong>Tickets</strong><span>{detail.tickets.length}</span></header>
            <div className="crz-customer360-stack">{detail.tickets.slice(0,10).map((item:any)=><a key={item.id} href={"/tickets/"+item.id}><span><strong>{item.subject}</strong><small>{item.category} • {dateTime(item.updated_at)}</small></span><Badge tone={tone(item.status)}>{item.status}</Badge></a>)}</div>
          </section>
        </>}
      </aside>
    </div>
  </div></main>;
}
