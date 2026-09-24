"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, PageHeader } from "@/core/design-system";
import type { SupportDeskPayload, SupportDeskThread, SupportDeskTicket } from "./types";
import type { SupportMessage } from "@/modules/support";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function dateTime(value:string|null|undefined){
  if(!value)return"—";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"—":date.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
}
function tone(value:string):"green"|"blue"|"pink"|"gold"|"neutral"{
  if(["resolved","closed"].includes(value))return"green";
  if(["waiting_staff","waiting_user","open","normal"].includes(value))return"blue";
  if(value==="urgent")return"pink";
  if(value==="high")return"gold";
  return"neutral";
}

export function SupportDeskPage(){
  const [data,setData]=useState<SupportDeskPayload|null>(null);
  const [state,setState]=useState<"loading"|"ready"|"auth"|"forbidden"|"error">("loading");
  const [selected,setSelected]=useState<SupportDeskTicket|null>(null);
  const [thread,setThread]=useState<SupportDeskThread|null>(null);
  const [threadLoading,setThreadLoading]=useState(false);
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("");
  const [priority,setPriority]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState<string|null>(null);
  const [notice,setNotice]=useState("");
  const selectedIdRef=useRef<string|null>(null);
  const messagesRef=useRef<HTMLDivElement|null>(null);
  const realtimeTimer=useRef<number|null>(null);

  const load=useCallback(async()=>{
    try{
      const params=new URLSearchParams();
      if(query.trim())params.set("q",query.trim());
      if(status)params.set("status",status);
      if(priority)params.set("priority",priority);
      const response=await fetch("/api/admin/support?"+params.toString(),{cache:"no-store"});
      if(response.status===401)return setState("auth");
      if(response.status===403)return setState("forbidden");
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!Array.isArray(payload.tickets))throw new Error();
      setData(payload as SupportDeskPayload);
      setState("ready");
    }catch{setState("error")}
  },[priority,query,status]);

  const refreshThread=useCallback(async(ticketId:string)=>{
    const response=await fetch("/api/support/"+encodeURIComponent(ticketId),{cache:"no-store"});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.ticket)throw new Error("THREAD_FAILED");
    setThread(payload as SupportDeskThread);
  },[]);

  const loadThread=useCallback(async(ticket:SupportDeskTicket)=>{
    setSelected(ticket);
    selectedIdRef.current=ticket.id;
    setThread(null);
    setThreadLoading(true);
    setNotice("");
    try{
      await refreshThread(ticket.id);
    }catch{setNotice("Não foi possível abrir este ticket.")}
    finally{setThreadLoading(false)}
  },[refreshThread]);

  useEffect(()=>{void load()},[load]);

  useEffect(()=>{
    const supabase=createBrowserSupabaseClient();

    const schedule=(ticketId?:string)=>{
      if(realtimeTimer.current)window.clearTimeout(realtimeTimer.current);
      realtimeTimer.current=window.setTimeout(()=>{
        realtimeTimer.current=null;
        void load();
        if(ticketId&&selectedIdRef.current===ticketId){
          void refreshThread(ticketId).catch(()=>setNotice("Falha ao atualizar conversa em tempo real."));
        }
      },120);
    };

    const channel=supabase
      .channel("support-desk-live")
      .on(
        "postgres_changes",
        {event:"INSERT",schema:"public",table:"support_messages"},
        (payload:any)=>schedule(String((payload.new as {ticket_id?:unknown})?.ticket_id||""))
      )
      .on(
        "postgres_changes",
        {event:"INSERT",schema:"public",table:"support_attachments"},
        payload=>schedule(String((payload.new as {ticket_id?:unknown})?.ticket_id||""))
      )
      .on(
        "postgres_changes",
        {event:"UPDATE",schema:"public",table:"support_tickets"},
        (payload:any)=>schedule(String((payload.new as {id?:unknown})?.id||""))
      )
      .subscribe();

    const fallback=window.setInterval(()=>{
      if(document.visibilityState!=="visible")return;
      void load();
      if(selectedIdRef.current){
        void refreshThread(selectedIdRef.current).catch(()=>undefined);
      }
    },30000);

    return()=>{
      if(realtimeTimer.current){
        window.clearTimeout(realtimeTimer.current);
        realtimeTimer.current=null;
      }
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  },[load,refreshThread]);

  useEffect(()=>{
    if(!thread?.messages.length)return;
    window.requestAnimationFrame(()=>{
      if(messagesRef.current){
        messagesRef.current.scrollTo({top:messagesRef.current.scrollHeight,behavior:"smooth"});
      }
    });
  },[thread?.messages.length]);

  const updateTicket=async(patch:Record<string,unknown>)=>{
    if(!selected||busy)return;
    setBusy("update");
    try{
      const response=await fetch("/api/admin/support",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ticketId:selected.id,...patch})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||"UPDATE_FAILED");
      setNotice("Ticket atualizado.");
      setSelected(current=>current?{...current,...patch} as SupportDeskTicket:current);
      await load();
      await refreshThread(selected.id);
    }catch{setNotice("Não foi possível atualizar o ticket.")}
    finally{setBusy(null)}
  };

  const sendMessage=async()=>{
    if(!selected||!message.trim()||busy)return;
    setBusy("message");
    try{
      const response=await fetch("/api/support/"+encodeURIComponent(selected.id)+"/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:message.trim()})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||"MESSAGE_FAILED");
      const sentId=String(payload.messageId||("local-"+Date.now()));
      const knownStaff=
        thread?.messages.find(item=>item.senderRole==="staff")?.sender||
        {id:null,name:"CRAZZY Support",avatarUrl:null};
      const optimisticMessage:SupportMessage={
        id:sentId,
        senderRole:"staff",
        message:message.trim(),
        editedAt:null,
        createdAt:new Date().toISOString(),
        sender:knownStaff,
      };
      setThread(current=>{
        if(!current||current.messages.some(item=>item.id===sentId))return current;
        return {...current,messages:[...current.messages,optimisticMessage]};
      });
      setMessage("");
      setNotice("Resposta enviada.");
      void load();
    }catch{setNotice("Não foi possível enviar a resposta.")}
    finally{setBusy(null)}
  };

  const queue=useMemo(()=>data?.tickets||[],[data]);

  if(state==="loading"&&!data)return <main className="crz-supportdesk-state"><span className="crz-spinner"/><strong>Carregando Support Desk...</strong></main>;
  if(state==="auth")return <main className="crz-supportdesk-state"><strong>Entre para continuar.</strong></main>;
  if(state==="forbidden")return <main className="crz-supportdesk-state"><strong>Acesso de administrador necessário.</strong></main>;
  if(state==="error"||!data)return <main className="crz-supportdesk-state"><strong>Support Desk indisponível.</strong><button onClick={()=>void load()}>Tentar novamente</button></main>;

  return <main className="crz-supportdesk"><div className="crz-container crz-supportdesk__container">
    <PageHeader eyebrow="M32 • SUPPORT DESK" title="Atendimento sem ticket perdido" description="Fila global, prioridade, responsável, conversa e contexto do cliente em um único painel." actions={<button className="crz-button crz-button--secondary crz-button--sm" onClick={()=>void load()}>↻ Atualizar</button>}/>

    <section className="crz-supportdesk-stats">
      <article><small>VISÍVEIS</small><strong>{data.stats.total}</strong><span>filtro atual</span></article>
      <article className={data.stats.waitingStaff?"is-alert":""}><small>AGUARDANDO EQUIPE</small><strong>{data.stats.waitingStaff}</strong><span>precisam de resposta</span></article>
      <article><small>AGUARDANDO CLIENTE</small><strong>{data.stats.waitingUser}</strong><span>resposta pendente</span></article>
      <article className={data.stats.urgent?"is-alert":""}><small>URGENTES</small><strong>{data.stats.urgent}</strong><span>prioridade máxima</span></article>
      <article><small>SEM RESPONSÁVEL</small><strong>{data.stats.unassigned}</strong><span>na fila</span></article>
    </section>

    <section className="crz-supportdesk-toolbar">
      <label><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void load()}} placeholder="Assunto do ticket..."/></label>
      <select value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="">Todos os status</option><option value="waiting_staff">Aguardando equipe</option><option value="waiting_user">Aguardando cliente</option><option value="open">Aberto</option><option value="resolved">Resolvido</option><option value="closed">Fechado</option>
      </select>
      <select value={priority} onChange={e=>setPriority(e.target.value)}>
        <option value="">Todas prioridades</option><option value="urgent">Urgente</option><option value="high">Alta</option><option value="normal">Normal</option><option value="low">Baixa</option>
      </select>
      <button className="crz-button crz-button--primary crz-button--sm" onClick={()=>void load()}>Filtrar</button>
    </section>

    {notice&&<div className="crz-supportdesk-notice">{notice}</div>}

    <div className="crz-supportdesk-layout">
      <section className="crz-supportdesk-list">
        {queue.map(ticket=><button key={ticket.id} className={"crz-supportdesk-ticket"+(selected?.id===ticket.id?" is-selected":"")} onClick={()=>void loadThread(ticket)}>
          <div>
            <span><Badge tone={tone(ticket.priority)}>{ticket.priority.toUpperCase()}</Badge><Badge tone={tone(ticket.status)}>{ticket.status}</Badge></span>
            <strong>{ticket.subject}</strong>
            <p>{ticket.lastMessagePreview||"Sem prévia de mensagem."}</p>
            <small>{ticket.customer.discordUsername||ticket.customer.username||ticket.userId.slice(0,8)} • {dateTime(ticket.lastMessageAt||ticket.updatedAt)}</small>
          </div>
          <aside><strong>{ticket.attachmentCount}</strong><small>anexo(s)</small><em>{ticket.assignedTo?"atribuído":"fila"}</em></aside>
        </button>)}
        {!queue.length&&<div className="crz-supportdesk-empty">Nenhum ticket neste filtro.</div>}
      </section>

      <aside className="crz-supportdesk-thread">
        {!selected?<div className="crz-supportdesk-empty"><strong>Escolha um ticket</strong><span>A conversa aparece aqui.</span></div>:threadLoading?<div className="crz-supportdesk-empty"><span className="crz-spinner"/><span>Carregando conversa...</span></div>:thread?<>
          <header className="crz-supportdesk-thread__head">
            <div><small>{selected.category.toUpperCase()}</small><h2>{selected.subject}</h2><span>{selected.customer.discordUsername||selected.customer.username||selected.userId}</span></div>
            <a href={"/admin/clientes?userId="+encodeURIComponent(selected.userId)}>Customer 360 →</a>
          </header>

          <div className="crz-supportdesk-actions">
            <button onClick={()=>void updateTicket({assignee:"me"})} disabled={Boolean(busy)}>Assumir</button>
            <select value={selected.priority} onChange={e=>void updateTicket({priority:e.target.value})} disabled={Boolean(busy)}>
              <option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option>
            </select>
            <select value={thread.ticket.status} onChange={e=>void updateTicket({status:e.target.value})} disabled={Boolean(busy)}>
              <option value="waiting_staff">Aguardando equipe</option><option value="waiting_user">Aguardando cliente</option><option value="open">Aberto</option><option value="resolved">Resolvido</option><option value="closed">Fechado</option>
            </select>
          </div>

          <div ref={messagesRef} className="crz-supportdesk-messages">
            {thread.messages.map(item=><article key={item.id} className={"is-"+item.senderRole}><header><strong>{item.sender.name}</strong><span>{dateTime(item.createdAt)}</span></header><p>{item.message}</p></article>)}
            {!thread.messages.length&&<em>Sem mensagens.</em>}
          </div>

          <div className="crz-supportdesk-compose">
            <textarea value={message} onChange={e=>setMessage(e.target.value.slice(0,4000))} placeholder="Responder como CRAZZY Support..."/>
            <button className="crz-button crz-button--primary crz-button--sm" onClick={()=>void sendMessage()} disabled={Boolean(busy)||!message.trim()}>{busy==="message"?"Enviando...":"Enviar resposta"}</button>
          </div>
        </>:null}
      </aside>
    </div>
  </div></main>;
}
