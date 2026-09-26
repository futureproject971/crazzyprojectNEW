"use client";
import {useCallback,useEffect,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";
type Row=Record<string,any>;
export function NotificationManagerPage(){
 const [data,setData]=useState<any>({notifications:[],jobs:[]}),[state,setState]=useState<"loading"|"ready"|"error">("loading"),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{try{const r=await fetch("/api/admin/notifications",{cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error();setData(p);setState("ready")}catch{setState("error")}},[]);
 useEffect(()=>{void load()},[]);
 const [draft,setDraft]=useState<{userId:string;title:string;body:string;discord:boolean}|null>(null),[customerQuery,setCustomerQuery]=useState(""),[customers,setCustomers]=useState<Row[]>([]),[busy,setBusy]=useState(false);
 const search=async()=>{try{const r=await fetch("/api/admin/customers?q="+encodeURIComponent(customerQuery)+"&limit=12");const p=await r.json();setCustomers(r.ok?p.customers||[]:[])}catch{setNotice("Não foi possível buscar clientes.")}};
 const send=async()=>{
   if(!draft?.userId||!draft.title.trim()||busy)return;
   setBusy(true);
   try{const r=await fetch("/api/admin/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...draft,type:"info"})});
   setNotice(r.ok?"Notificação criada.":"Falha ao criar notificação.");if(r.ok){setDraft(null);await load()}}
   catch{setNotice("Não foi possível enviar. Tente novamente.")}finally{setBusy(false)}
 };
 if(state==="loading")return <main className="crz-notify-state"><span className="crz-spinner"/></main>;
 if(state==="error")return <main className="crz-notify-state">Notify Manager indisponível.</main>;
 const queued=data.jobs.filter((x:Row)=>["queued","processing","failed"].includes(x.status)).length;
 return <main className="crz-notify"><div className="crz-container">
  <PageHeader eyebrow="M41 • NOTIFY MANAGER" title="Avisos do site e Discord numa fila só" description="Crie uma notificação para o cliente e, quando necessário, espelhe por DM no Discord." actions={<button className="crz-button crz-button--primary crz-button--sm" onClick={()=>setDraft({userId:"",title:"",body:"",discord:false})}>+ Notificação</button>}/>
  {draft&&<form className="crz-notify-form" onSubmit={e=>{e.preventDefault();void send()}}>
   <h2>Nova notificação</h2><label>Cliente<input value={customerQuery} onChange={e=>setCustomerQuery(e.target.value)} placeholder="Nome, e-mail ou Discord"/></label><button type="button" onClick={()=>void search()}>Buscar cliente</button>
   <div>{customers.map(u=><button type="button" key={u.user_id} aria-pressed={draft.userId===u.user_id} onClick={()=>setDraft({...draft,userId:u.user_id})}>{draft.userId===u.user_id?"✓ ":""}{u.discord_global_name||u.username||u.discord_username||u.email||"Cliente"}</button>)}</div>
   <label>Título<input required maxLength={180} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
   <label>Mensagem<textarea maxLength={2000} rows={4} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})}/></label>
   <label><input type="checkbox" checked={draft.discord} onChange={e=>setDraft({...draft,discord:e.target.checked})}/> Enviar também por DM no Discord</label>
   <div><button type="button" disabled={busy} onClick={()=>setDraft(null)}>Cancelar</button><button disabled={busy||!draft.userId||!draft.title.trim()}>{busy?"Enviando...":"Enviar notificação"}</button></div>
  </form>}
  <section className="crz-notify-summary"><article><small>RECENTES</small><strong>{data.notifications.length}</strong></article><article className={queued?"is-alert":""}><small>FILA DISCORD</small><strong>{queued}</strong></article></section>
  {notice&&<p className="crz-notify-notice">{notice}</p>}
  <section className="crz-notify-admin">{data.jobs.slice(0,100).map((job:Row)=><article key={job.id}><span><strong>{job.title}</strong><small>{job.customer_name||"Cliente"}</small></span><Badge tone={job.status==="sent"?"green":job.status==="failed"?"pink":"blue"}>{job.status}</Badge><small>{job.last_error_code||""}</small></article>)}{!data.jobs.length&&<div className="crz-notify-empty">Nenhuma DM enfileirada.</div>}</section>
 </div></main>
}
