"use client";
import {useCallback,useEffect,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";

type Row=Record<string,any>;

function date(v:string|null){
  if(!v)return"—";
  const d=new Date(v);
  return Number.isNaN(d.getTime())?"—":d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
}
function tone(s:string):"green"|"blue"|"pink"|"gold"|"neutral"{
  if(s==="critical")return"pink";
  if(s==="high")return"gold";
  if(s==="resolved")return"green";
  if(s==="acknowledged")return"blue";
  return"neutral";
}

export function SecuritySentinelPage(){
  const [data,setData]=useState<any>(null);
  const [state,setState]=useState<"loading"|"ready"|"error">("loading");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    try{
      const r=await fetch("/api/admin/security",{cache:"no-store"});
      const p=await r.json();
      if(!r.ok)throw new Error();
      setData(p);
      setState("ready");
    }catch{setState("error")}
  },[]);

  useEffect(()=>{
    void load();
    const t=setInterval(()=>void load(),10000);
    return()=>clearInterval(t);
  },[]);

  const stats=data?.stats||{critical:0,high:0,open:0,resolved:0};

  const setStatus=async(id:string,status:string)=>{
    const r=await fetch("/api/admin/security",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"set_status",eventId:id,status})});
    setNotice(r.ok?"Evento atualizado.":"Falha ao atualizar evento.");
    if(r.ok)await load();
  };

  const config=async()=>{
    const channelId=window.prompt("ID do canal privado #security-logs:");
    if(channelId===null)return;
    const roleId=window.prompt("ID do cargo que será pingado SOMENTE em CRITICAL (opcional):")||"";
    const r=await fetch("/api/admin/security",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"set_discord",channelId,roleId})});
    setNotice(r.ok?"Configuração de segurança salva.":"Falha ao salvar configuração.");
    if(r.ok)await load();
  };

  if(state==="loading")return <main className="crz-security-state"><span className="crz-spinner"/></main>;
  if(state==="error"||!data)return <main className="crz-security-state">Security Sentinel indisponível.</main>;

  return <main className="crz-security"><div className="crz-container">
    <PageHeader eyebrow="M47 • SECURITY SENTINEL" title="Problema crítico não pode morrer num log" description="Eventos de segurança deduplicados, auditáveis e com alerta privado no Discord." actions={<button className="crz-button crz-button--secondary crz-button--sm" onClick={()=>void config()}>Configurar Discord</button>}/>

    <section className="crz-security-stats">
      <article className={stats.critical?"is-critical":""}><small>CRITICAL</small><strong>{stats.critical}</strong></article>
      <article><small>HIGH</small><strong>{stats.high}</strong></article>
      <article><small>ABERTOS</small><strong>{stats.open}</strong></article>
      <article><small>RESOLVIDOS</small><strong>{stats.resolved}</strong></article>
    </section>

    <div className="crz-security-config">
      <Badge tone={data.config.channelConfigured?"green":"pink"}>{data.config.channelConfigured?"CANAL CONFIGURADO":"CANAL FALTANDO"}</Badge>
      <Badge tone={data.config.criticalRoleConfigured?"green":"neutral"}>{data.config.criticalRoleConfigured?"ROLE CRITICAL CONFIGURADA":"SEM PING DE ROLE"}</Badge>
    </div>

    {notice&&<p className="crz-security-notice">{notice}</p>}

    <section className="crz-security-list">
      {data.events.map((e:Row)=><article key={e.id} className={"is-"+e.severity}>
        <header><div><Badge tone={tone(e.severity)}>{e.severity.toUpperCase()}</Badge><strong>{e.title}</strong></div><Badge tone={tone(e.status)}>{e.status}</Badge></header>
        <p>{e.message}</p>
        <footer>
          <span>{e.category} • {e.source} • {e.occurrences} ocorrência(s) • {date(e.last_seen_at)}</span>
          <div>{e.status==="open"&&<button onClick={()=>void setStatus(e.id,"acknowledged")}>Reconhecer</button>}{e.status!=="resolved"&&<button onClick={()=>void setStatus(e.id,"resolved")}>Resolver</button>}{e.target_user_id&&<a href={"/admin/clientes?userId="+e.target_user_id}>Cliente →</a>}</div>
        </footer>
      </article>)}
      {!data.events.length&&<div className="crz-security-empty">Nenhum evento de segurança.</div>}
    </section>
  </div></main>;
}
