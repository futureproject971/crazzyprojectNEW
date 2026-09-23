"use client";
import {useCallback,useEffect,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";
type Row=Record<string,any>;
export function NotificationManagerPage(){
 const [data,setData]=useState<any>({notifications:[],jobs:[]}),[state,setState]=useState<"loading"|"ready"|"error">("loading"),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{try{const r=await fetch("/api/admin/notifications",{cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error();setData(p);setState("ready")}catch{setState("error")}},[]);
 useEffect(()=>{void load()},[]);
 const send=async()=>{
   const userId=window.prompt("UUID do cliente:");if(!userId)return;
   const title=window.prompt("Título da notificação:");if(!title)return;
   const body=window.prompt("Mensagem:")||"";
   const discord=window.confirm("Também enviar por DM no Discord?");
   const r=await fetch("/api/admin/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,type:"info",title,body,discord})});
   setNotice(r.ok?"Notificação criada.":"Falha ao criar notificação.");if(r.ok)await load();
 };
 if(state==="loading")return <main className="crz-notify-state"><span className="crz-spinner"/></main>;
 if(state==="error")return <main className="crz-notify-state">Notify Manager indisponível.</main>;
 const queued=data.jobs.filter((x:Row)=>["queued","processing","failed"].includes(x.status)).length;
 return <main className="crz-notify"><div className="crz-container">
  <PageHeader eyebrow="M41 • NOTIFY MANAGER" title="Avisos do site e Discord numa fila só" description="Crie uma notificação para o cliente e, quando necessário, espelhe por DM no Discord." actions={<button className="crz-button crz-button--primary crz-button--sm" onClick={()=>void send()}>+ Notificação</button>}/>
  <section className="crz-notify-summary"><article><small>RECENTES</small><strong>{data.notifications.length}</strong></article><article className={queued?"is-alert":""}><small>FILA DISCORD</small><strong>{queued}</strong></article></section>
  {notice&&<p className="crz-notify-notice">{notice}</p>}
  <section className="crz-notify-admin">{data.jobs.slice(0,100).map((job:Row)=><article key={job.id}><span><strong>{job.title}</strong><small>{job.discord_user_id||job.user_id}</small></span><Badge tone={job.status==="sent"?"green":job.status==="failed"?"pink":"blue"}>{job.status}</Badge><small>{job.last_error_code||""}</small></article>)}{!data.jobs.length&&<div className="crz-notify-empty">Nenhuma DM enfileirada.</div>}</section>
 </div></main>
}
