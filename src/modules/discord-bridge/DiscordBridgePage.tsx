"use client";

import {useCallback,useEffect,useState} from "react";
import {CustomerRoleSettings} from "./CustomerRoleSettings";
import {Badge,PageHeader} from "@/core/design-system";

type Row=Record<string,any>;

function date(v:string|null){
  if(!v)return"—";
  const d=new Date(v);
  return Number.isNaN(d.getTime())?"—":d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
}
function tone(s:string):"green"|"blue"|"pink"|"gold"|"neutral"{
  if(["granted","revoked"].includes(s))return"green";
  if(["pending","processing"].includes(s))return"blue";
  if(s==="failed")return"pink";
  return"neutral";
}

export function DiscordBridgePage(){
  const [data,setData]=useState<any>(null);
  const [state,setState]=useState<"loading"|"ready"|"error">("loading");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    try{
      const r=await fetch("/api/admin/discord-bridge",{cache:"no-store"});
      const p=await r.json();
      if(!r.ok)throw new Error();
      setData(p);
      setState("ready");
    }catch{setState("error")}
  },[]);

  useEffect(()=>{
    void load();
    const t=setInterval(()=>void load(),7000);
    return()=>clearInterval(t);
  },[]);

  const stats=data?.stats||{pending:0,failed:0,granted:0,revoke:0};

  const online=Boolean(data?.worker?.connected&&data.worker.last_seen_at&&Date.now()-new Date(data.worker.last_seen_at).getTime()<45000);

  const requeue=async(id:string)=>{
    const r=await fetch("/api/admin/discord-bridge",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"requeue",id})
    });
    setNotice(r.ok?"Grant recolocado na fila.":"Não foi possível reprocessar.");
    if(r.ok)await load();
  };

  if(state==="loading")return <main className="crz-bridge-state"><span className="crz-spinner"/><strong>Carregando Discord Bridge...</strong></main>;
  if(state==="error"||!data)return <main className="crz-bridge-state"><strong>Discord Bridge indisponível.</strong><button onClick={()=>void load()}>Tentar novamente</button></main>;

  return <main className="crz-bridge"><div className="crz-container">
    <PageHeader
      eyebrow="SISTEMA • CARGOS DISCORD"
      title="O site manda, o Discord sincroniza"
      description="Compras liberam o acesso na loja. O bot aplica os cargos no Discord e registra aqui as concessões e falhas."
      actions={<Badge tone={online?"green":"pink"}>{online?"BOT CORE ONLINE":"BOT CORE OFFLINE"}</Badge>}
    />

    <CustomerRoleSettings/>
    {!online && <p role="status" className="crz-bridge-notice">Sem confirmação recente de atividade do bot. As concessões ficam na fila até a conexão ser restabelecida.</p>}
    <section className="crz-bridge-stats">
      <article><small>FILA</small><strong>{stats.pending}</strong></article>
      <article className={stats.failed?"is-danger":""}><small>FALHAS</small><strong>{stats.failed}</strong></article>
      <article><small>GRANTED</small><strong>{stats.granted}</strong></article>
      <article><small>REVOKES</small><strong>{stats.revoke}</strong></article>
    </section>

    {notice&&<p className="crz-bridge-notice">{notice}</p>}

    <section className="crz-bridge-table">
      <header><span>Cliente</span><span>Role</span><span>Desejado</span><span>Status</span><span>Tentativas</span><span>Última</span><span>Ação</span></header>
      {data.grants.map((g:Row)=><article key={g.id}>
        <span><strong>{g.customer?.username||g.user_id.slice(0,8)}</strong><small>{g.discord_user_id||"sem Discord"}</small></span>
        <span><strong>{g.role_name||g.role_id}</strong><small>{g.guild_id||"sem guild"}</small></span>
        <span><Badge tone={g.desired_state==="granted"?"blue":"gold"}>{g.desired_state}</Badge></span>
        <span><Badge tone={tone(g.status)}>{g.status}</Badge><small>{g.last_error_code||""}</small></span>
        <span><strong>{g.attempt_count}</strong></span>
        <span><small>{date(g.last_attempt_at||g.updated_at)}</small></span>
        <span>{g.status==="failed"||g.status==="pending"?<button onClick={()=>void requeue(g.id)}>Reprocessar</button>:<a href={"/admin/clientes?userId="+g.user_id}>Cliente</a>}</span>
      </article>)}
      {!data.grants.length&&<div className="crz-bridge-empty">Nenhum grant registrado ainda.</div>}
    </section>
  </div></main>;
}
