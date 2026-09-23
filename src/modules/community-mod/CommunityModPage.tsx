"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";
import type {CommunityModMessage,CommunityModPayload} from "./types";

function dateTime(value:string|null|undefined){
  if(!value)return"—";
  const d=new Date(value);
  return Number.isNaN(d.getTime())?"—":d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
}

export function CommunityModPage(){
  const [data,setData]=useState<CommunityModPayload|null>(null);
  const [state,setState]=useState<"loading"|"ready"|"auth"|"forbidden"|"error">("loading");
  const [query,setQuery]=useState("");
  const [channel,setChannel]=useState("");
  const [selected,setSelected]=useState<CommunityModMessage|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    try{
      const response=await fetch("/api/admin/community-mod",{cache:"no-store"});
      if(response.status===401)return setState("auth");
      if(response.status===403)return setState("forbidden");
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!Array.isArray(payload.messages))throw new Error();
      setData(payload as CommunityModPayload);
      setState("ready");
    }catch{setState("error")}
  },[]);

  useEffect(()=>{void load()},[]);

  const messages=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return(data?.messages||[]).filter(item=>{
      const author=(item.author.discordUsername||item.author.username||"").toLowerCase();
      const body=String(item.body||"").toLowerCase();
      return(!q||body.includes(q)||author.includes(q)||item.userId.includes(q))&&(!channel||item.channel.slug===channel);
    });
  },[channel,data,query]);

  const channels=useMemo(()=>[...new Map((data?.messages||[]).map(item=>[item.channel.slug,item.channel])).values()],[data]);

  const moderate=async(action:"delete_message"|"ban_user"|"unban_user",item:CommunityModMessage)=>{
    if(busy)return;
    const label=action==="delete_message"?"apagar a mensagem":action==="ban_user"?"banir o usuário":"desbanir o usuário";
    const reason=window.prompt("Motivo para "+label+":");
    if(!reason?.trim()||reason.trim().length<3)return;

    setBusy(true);
    setNotice("");
    try{
      const response=await fetch("/api/admin/community-mod",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,messageId:item.id,targetUserId:item.userId,reason:reason.trim()})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||"MOD_FAILED");
      setNotice("Ação registrada no histórico de moderação.");
      setSelected(null);
      await load();
    }catch(error){setNotice(error instanceof Error?"Falha: "+error.message:"Não foi possível aplicar a moderação.")}
    finally{setBusy(false)}
  };

  if(state==="loading"&&!data)return <main className="crz-communitymod-state"><span className="crz-spinner"/><strong>Carregando moderação...</strong></main>;
  if(state==="auth")return <main className="crz-communitymod-state"><strong>Entre para continuar.</strong></main>;
  if(state==="forbidden")return <main className="crz-communitymod-state"><strong>Acesso de administrador necessário.</strong></main>;
  if(state==="error"||!data)return <main className="crz-communitymod-state"><strong>Community Mod indisponível.</strong><button onClick={()=>void load()}>Tentar novamente</button></main>;

  return <main className="crz-communitymod"><div className="crz-container crz-communitymod__container">
    <PageHeader eyebrow="M33 • COMMUNITY MOD" title="Moderação com rastro" description="Mensagens, exclusões e banimentos registrados para a equipe saber exatamente o que aconteceu." actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/comunidade">Abrir comunidade</a>}/>

    <section className="crz-communitymod-summary">
      <article><small>MENSAGENS</small><strong>{data.messages.length}</strong><span>últimas carregadas</span></article>
      <article><small>REMOVIDAS</small><strong>{data.messages.filter(item=>item.deleted).length}</strong><span>soft delete</span></article>
      <article><small>USUÁRIOS BANIDOS</small><strong>{new Set(data.messages.filter(item=>item.author.banned).map(item=>item.userId)).size}</strong><span>na amostra</span></article>
      <article><small>AÇÕES</small><strong>{data.actions.length}</strong><span>histórico recente</span></article>
    </section>

    <section className="crz-communitymod-toolbar">
      <label><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Mensagem, usuário ou UUID..."/></label>
      <select value={channel} onChange={e=>setChannel(e.target.value)}><option value="">Todos os canais</option>{channels.map(item=><option key={item.slug} value={item.slug}>#{item.name}</option>)}</select>
      <button className="crz-button crz-button--secondary crz-button--sm" onClick={()=>void load()}>↻ Atualizar</button>
    </section>

    {notice&&<div className="crz-communitymod-notice">{notice}</div>}

    <div className="crz-communitymod-layout">
      <section className="crz-communitymod-feed">
        {messages.map(item=><button key={item.id} className={"crz-communitymod-message"+(selected?.id===item.id?" is-selected":"")+(item.deleted?" is-deleted":"")} onClick={()=>setSelected(item)}>
          <div className="crz-communitymod-message__head">
            <strong>{item.author.discordUsername||item.author.username||item.userId.slice(0,8)}</strong>
            <span>#{item.channel.name} • {dateTime(item.createdAt)}</span>
            {item.author.banned&&<Badge tone="pink">BANIDO</Badge>}
            {item.deleted&&<Badge tone="neutral">REMOVIDA</Badge>}
          </div>
          <p>{item.deleted?"Mensagem removida.":item.body}</p>
          <small>{item.author.guildMember?"✓ Discord verificado":item.author.discordUserId?"Discord conectado":"sem Discord"} • {item.author.roles.join(", ")||"user"}</small>
        </button>)}
        {!messages.length&&<div className="crz-communitymod-empty">Nenhuma mensagem encontrada.</div>}
      </section>

      <aside className="crz-communitymod-detail">
        {!selected?<div className="crz-communitymod-empty"><strong>Selecione uma mensagem</strong><span>As ações de moderação aparecem aqui.</span></div>:<>
          <header><div><small>USUÁRIO</small><h2>{selected.author.discordUsername||selected.author.username||selected.userId}</h2><span>{selected.userId}</span></div><Badge tone={selected.author.banned?"pink":"green"}>{selected.author.banned?"BANIDO":"ATIVO"}</Badge></header>
          <div className="crz-communitymod-kv">
            <span><small>Discord ID</small><strong>{selected.author.discordUserId||"—"}</strong></span>
            <span><small>Servidor</small><strong>{selected.author.guildMember?"Membro":"Não verificado"}</strong></span>
            <span><small>Roles</small><strong>{selected.author.roles.join(", ")||"user"}</strong></span>
            <span><small>Mensagem</small><strong>{selected.id}</strong></span>
          </div>
          <div className="crz-communitymod-actions">
            {!selected.deleted&&<button disabled={busy} onClick={()=>void moderate("delete_message",selected)}>Apagar com motivo</button>}
            {!selected.author.banned?<button className="is-danger" disabled={busy} onClick={()=>void moderate("ban_user",selected)}>Banir usuário</button>:<button className="is-good" disabled={busy} onClick={()=>void moderate("unban_user",selected)}>Desbanir</button>}
            <a href={"/admin/clientes?userId="+encodeURIComponent(selected.userId)}>Customer 360 →</a>
          </div>
          {selected.author.bannedReason&&<p className="crz-communitymod-banreason"><strong>Motivo atual:</strong> {selected.author.bannedReason}</p>}
          <section className="crz-communitymod-history">
            <header><strong>Histórico recente</strong></header>
            {data.actions.filter(action=>action.target_user_id===selected.userId||action.message_id===selected.id).slice(0,20).map(action=><article key={action.id}><span><Badge tone={action.action==="ban_user"?"pink":action.action==="unban_user"?"green":"gold"}>{action.action}</Badge><small>{dateTime(action.created_at)}</small></span><p>{action.reason}</p></article>)}
          </section>
        </>}
      </aside>
    </div>
  </div></main>;
}
