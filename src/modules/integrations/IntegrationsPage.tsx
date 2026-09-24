"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {Badge,Dialog,PageHeader} from "@/core/design-system";
type Item={id:string;name:string;state:"ready"|"partial"|"missing"|"offline"|"enabled"|"disabled";detail:string;meta?:Record<string,unknown>|null};
type Payload={generatedAt:string;integrations:Item[]};
function tone(state:Item["state"]):"green"|"blue"|"gold"|"pink"|"neutral"{if(["ready","enabled"].includes(state))return"green";if(state==="partial")return"gold";if(["missing","offline"].includes(state))return"pink";return"neutral"}
function label(state:Item["state"]){return({ready:"PRONTO",partial:"PARCIAL",missing:"FALTANDO",offline:"OFFLINE",enabled:"ATIVO",disabled:"DESLIGADO"} as Record<string,string>)[state]||state}
export function IntegrationsPage(){
 const [data,setData]=useState<Payload|null>(null),[state,setState]=useState<"loading"|"ready"|"error">("loading"),[notice,setNotice]=useState(""),[inviteOpen,setInviteOpen]=useState(false),[inviteUrl,setInviteUrl]=useState(""),[saving,setSaving]=useState(false);
 const load=useCallback(async()=>{try{const r=await fetch("/api/admin/integrations",{cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error();setData(p);setState("ready")}catch{setState("error")}},[]);
 useEffect(()=>{void load()},[]);
 const configureInvite=async()=>{
   const value=inviteUrl.trim();
   if(!value){setNotice("Cole um convite do Discord antes de salvar.");return}
   setSaving(true);
   const r=await fetch("/api/admin/integrations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"set_discord_invite",inviteUrl:value})});
   const p=await r.json().catch(()=>({}));
   setNotice(r.ok?"Convite oficial salvo.":"Falha: "+(p.detail||p.error||"convite inválido"));
   setSaving(false);
   if(r.ok){setInviteOpen(false);setInviteUrl("");await load()}
 };
 const ready=useMemo(()=>data?.integrations.filter(x=>["ready","enabled"].includes(x.state)).length||0,[data]);
 const blocked=useMemo(()=>data?.integrations.filter(x=>["missing","offline"].includes(x.state)).length||0,[data]);
 if(state==="loading")return <main className="crz-integrations-state"><span className="crz-spinner"/><strong>Auditando integrações...</strong></main>;
 if(state==="error"||!data)return <main className="crz-integrations-state"><strong>Não foi possível ler o estado das integrações.</strong><button onClick={()=>void load()}>Tentar novamente</button></main>;
 return <main className="crz-integrations"><div className="crz-container">
  <PageHeader eyebrow="M40 • SETTINGS & INTEGRATIONS" title="Semáforo da infraestrutura" description="Mostra o que está realmente configurado neste ambiente sem revelar tokens, secrets ou credenciais." actions={<button className="crz-button crz-button--secondary crz-button--sm" onClick={()=>void load()}>↻ Revalidar</button>}/>
  <section className="crz-integrations-stats"><article><small>PRONTOS</small><strong>{ready}</strong><span>integrações</span></article><article><small>BLOQUEIOS</small><strong>{blocked}</strong><span>faltando/offline</span></article><article><small>TOTAL</small><strong>{data.integrations.length}</strong><span>checados</span></article></section>
  {notice&&<div className="crz-integrations-note"><strong>Integrações</strong><span>{notice}</span></div>}
  <section className="crz-integrations-grid">{data.integrations.map(item=><article key={item.id} className={"is-"+item.state}><header><div><small>{item.id.toUpperCase()}</small><h2>{item.name}</h2></div><Badge tone={tone(item.state)}>{label(item.state)}</Badge></header><p>{item.detail}</p>{item.id==="discord-invite"&&<button className="crz-button crz-button--secondary crz-button--sm" type="button" onClick={()=>setInviteOpen(true)}>{item.state==="ready"?"Trocar convite":"Configurar convite"}</button>}{item.id==="discord-oauth"&&<a href="/login?next=%2Fcall">Testar login Discord →</a>}{item.id==="livekit"&&<a href="/call">Abrir CRAZZY CALL →</a>}{item.id==="mtsounds"&&<a href="/mtsounds">Abrir MTSOUNDS →</a>}{["pix","card","crypto"].includes(item.id)&&<a href="/admin/pagamentos">Abrir Payment Manager →</a>}{item.id==="discord-worker"&&<a href="/admin/discord">Abrir Bot Core →</a>}</article>)}</section>
  <div className="crz-integrations-note"><strong>Secrets nunca aparecem aqui.</strong><span>O painel mostra somente estado booleano e saúde operacional. Integrações externas podem exigir credenciais e callbacks nos painéis oficiais.</span></div>
  <Dialog open={inviteOpen} title="Configurar convite oficial do Discord" onClose={()=>!saving&&setInviteOpen(false)}>
   <form className="crz-integration-form" onSubmit={e=>{e.preventDefault();void configureInvite()}}>
    <label><span>Link do convite</span><small>Use um convite permanente do servidor CRAZZY PROJECT. Exemplo: discord.gg/SEU-CODIGO</small><input className="crz-input" value={inviteUrl} onChange={e=>setInviteUrl(e.target.value)} placeholder="https://discord.gg/..."/></label>
    <div className="crz-integration-form__help"><strong>O que isso faz?</strong><span>Usuários autenticados que ainda não estão no servidor recebem este convite no Guild Gate. O login continua ativo enquanto o site verifica a entrada automaticamente.</span></div>
    <div className="crz-integration-form__actions"><button type="button" className="crz-button crz-button--secondary crz-button--md" onClick={()=>setInviteOpen(false)} disabled={saving}>Cancelar</button><button type="submit" className="crz-button crz-button--primary crz-button--md" disabled={saving}>{saving?"Salvando...":"Salvar convite"}</button></div>
   </form>
  </Dialog>
 </div></main>
}
