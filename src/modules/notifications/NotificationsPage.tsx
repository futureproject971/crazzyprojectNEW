"use client";
import {useEffect,useMemo,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";
type N={id:string;notification_type:string;title:string;body:string;href:string|null;read_at:string|null;created_at:string};
function date(v:string){return new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}
export function NotificationsPage(){
 const [items,setItems]=useState<N[]>([]),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);const r=await fetch("/api/notifications",{cache:"no-store"});const p=await r.json().catch(()=>({}));setItems(p.notifications||[]);setLoading(false)};
 useEffect(()=>{void load()},[]);
 const unread=useMemo(()=>items.filter(x=>!x.read_at).length,[items]);
 const markAll=async()=>{await fetch("/api/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:null})});await load()};
 return <main className="crz-notify"><div className="crz-container">
  <PageHeader eyebrow="M41 • NOTIFY" title="Notificações CRAZZY" description="Pagamentos, entregas, suporte, CLUB e avisos importantes em um só lugar." actions={<button className="crz-button crz-button--secondary crz-button--sm" onClick={()=>void markAll()} disabled={!unread}>Marcar tudo como lido</button>}/>
  <section className="crz-notify-summary"><article><small>NÃO LIDAS</small><strong>{unread}</strong></article><article><small>TOTAL</small><strong>{items.length}</strong></article></section>
  {loading?<div className="crz-notify-empty"><span className="crz-spinner"/></div>:<section className="crz-notify-list">{items.map(item=><a key={item.id} href={item.href||"#"} className={item.read_at?"is-read":""}><span><Badge tone={item.read_at?"neutral":"blue"}>{item.notification_type}</Badge><small>{date(item.created_at)}</small></span><strong>{item.title}</strong><p>{item.body}</p></a>)}{!items.length&&<div className="crz-notify-empty">Sem notificações ainda.</div>}</section>}
 </div></main>
}
