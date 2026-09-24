"use client";

import {useCallback,useEffect,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";

type Row=Record<string,any>;

function money(c:number){
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(c)||0)/100);
}
function date(v:string|null){
  if(!v)return"—";
  const d=new Date(v);
  return Number.isNaN(d.getTime())?"—":d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
}
function tone(s:string):"green"|"blue"|"pink"|"gold"|"neutral"{
  if(s==="completed")return"green";
  if(["queued","running"].includes(s))return"blue";
  if(["failed","refunded","disputed"].includes(s))return"pink";
  if(s==="manual_review")return"gold";
  return"neutral";
}

export function FulfillmentManagerPage(){
  const [runs,setRuns]=useState<Row[]>([]);
  const [stats,setStats]=useState({running:0,manual:0,failed:0,completed:0});
  const [state,setState]=useState<"loading"|"ready"|"error">("loading");
  const [status,setStatus]=useState("");
  const [selected,setSelected]=useState<Row|null>(null);

  const load=useCallback(async()=>{
    try{
      const q=new URLSearchParams();
      if(status)q.set("status",status);
      const r=await fetch("/api/admin/fulfillment?"+q,{cache:"no-store"});
      const p=await r.json();
      if(!r.ok)throw new Error();
      setRuns(p.runs||[]);
      setStats(p.stats||{running:0,manual:0,failed:0,completed:0});
      setState("ready");
    }catch{setState("error")}
  },[status]);

  useEffect(()=>{void load()},[]);


  if(state==="loading")return <main className="crz-fulfillment-state"><span className="crz-spinner"/><strong>Carregando fulfillment...</strong></main>;
  if(state==="error")return <main className="crz-fulfillment-state"><strong>Fulfillment Engine indisponível.</strong><button onClick={()=>void load()}>Tentar novamente</button></main>;

  return <main className="crz-fulfillment"><div className="crz-container">
    <PageHeader
      eyebrow="M43 • FULFILLMENT ENGINE"
      title="Pagamento virou acesso, ou a gente sabe onde parou"
      description="Ledger idempotente de pedido, entitlement, Library e solicitação de cargo Discord."
      actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/admin/pagamentos">Payment Manager</a>}
    />

    <section className="crz-fulfillment-stats">
      <article><small>RODANDO</small><strong>{stats.running}</strong></article>
      <article className={stats.manual?"is-alert":""}><small>MANUAL</small><strong>{stats.manual}</strong></article>
      <article className={stats.failed?"is-danger":""}><small>FALHOU</small><strong>{stats.failed}</strong></article>
      <article><small>CONCLUÍDO</small><strong>{stats.completed}</strong></article>
    </section>

    <section className="crz-fulfillment-toolbar">
      <select value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="">Todos status</option>
        <option value="queued">Queued</option>
        <option value="running">Running</option>
        <option value="manual_review">Manual review</option>
        <option value="failed">Failed</option>
        <option value="completed">Completed</option>
        <option value="refunded">Refunded</option>
        <option value="disputed">Disputed</option>
      </select>
      <button onClick={()=>void load()}>↻ Atualizar</button>
    </section>

    <div className="crz-fulfillment-layout">
      <section className="crz-fulfillment-list">
        {runs.map(run=><button key={run.id} type="button" className={selected?.id===run.id?"is-selected":""} onClick={()=>setSelected(run)}>
          <span>
            <strong>{run.payment?.customer?.username||run.payment?.user_id?.slice(0,8)||run.payment_id.slice(0,8)}</strong>
            <small>{run.payment?.payment_method||"—"} • {date(run.updated_at)}</small>
          </span>
          <span>
            <Badge tone={tone(run.status)}>{run.status}</Badge>
            <small>{run.delivered_count}/{run.planned_units} entregue(s)</small>
          </span>
          <b>{run.payment?money(run.payment.amount):"—"}</b>
        </button>)}
        {!runs.length&&<div className="crz-fulfillment-empty">Nenhum fulfillment registrado ainda.</div>}
      </section>

      <aside className="crz-fulfillment-detail">
        {!selected?<div className="crz-fulfillment-empty"><strong>Selecione uma execução</strong></div>:<>
          <header>
            <div><small>PAGAMENTO</small><h2>{selected.payment_id}</h2><span>{date(selected.started_at)} → {date(selected.finished_at)}</span></div>
            <Badge tone={tone(selected.status)}>{selected.status}</Badge>
          </header>

          <div className="crz-fulfillment-kv">
            <span><small>Planejado</small><strong>{selected.planned_units}</strong></span>
            <span><small>Tickets</small><strong>{selected.ticket_count}</strong></span>
            <span><small>Entregue</small><strong>{selected.delivered_count}</strong></span>
            <span><small>Manual</small><strong>{selected.manual_count}</strong></span>
          </div>

          <section>
            <header><strong>Eventos</strong></header>
            {selected.events?.slice(0,30).map((e:Row)=><article key={e.id}>
              <span><Badge tone={e.level==="error"?"pink":e.level==="warn"?"gold":"blue"}>{e.event_type}</Badge><small>{date(e.created_at)}</small></span>
              <p>{e.message}</p>
            </article>)}
            {!selected.events?.length&&<em>Sem eventos.</em>}
          </section>

          <section>
            <header><strong>Tickets de entrega</strong></header>
            {selected.tickets?.map((t:Row)=><div key={t.id}>
              <span><strong>{t.status_label}</strong><small>{t.id.slice(0,8)} • {t.stock_item_id?"estoque automático":"manual/externo"}</small></span>
            </div>)}
          </section>

          <footer>
            <a href={"/admin/pagamentos?paymentId="+encodeURIComponent(selected.payment_id)}>Abrir pagamento →</a>
            <a href={"/admin/clientes?userId="+encodeURIComponent(selected.user_id)}>Customer 360 →</a>
          </footer>
        </>}
      </aside>
    </div>
  </div></main>;
}
