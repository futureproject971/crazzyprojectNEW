"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";\nimport {adminPrompt} from "@/core/ui/adminDialog";

type AnyRow=Record<string,any>;
export function RewardManagerPage(){
 const [data,setData]=useState<any>(null),[state,setState]=useState<"loading"|"ready"|"error">("loading"),[selected,setSelected]=useState<AnyRow|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{try{const r=await fetch("/api/admin/rewards",{cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error();setData(p);setState("ready")}catch{setState("error")}},[]);
 useEffect(()=>{void load()},[]);
 const pending=useMemo(()=>data?.sessions?.filter((x:AnyRow)=>["completed","requested","delivering"].includes(x.status))||[],[data]);
 const saveCampaign=async()=>{
  const current=selected?.kind==="campaign"?selected.row:null;
  const title=await adminPrompt("Campanha",{label:"Título",defaultValue:current?.title||"",required:true});if(!title)return;
  const videoUrl=await adminPrompt("Campanha",{label:"Vídeo (URL)",defaultValue:current?.video_url||"",required:true});if(!videoUrl)return;
  const watch=Number(await adminPrompt("Campanha",{label:"Segundos obrigatórios",defaultValue:String(current?.required_watch_seconds||60),inputMode:"numeric"}));if(!Number.isFinite(watch))return;
  const cooldown=Number(await adminPrompt("Campanha",{label:"Cooldown em horas",defaultValue:String(current?.cooldown_hours||168),inputMode:"numeric"}));if(!Number.isFinite(cooldown))return;
  setBusy(true);const r=await fetch("/api/admin/rewards",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save_campaign",id:current?.id,title,description:current?.description||"",videoUrl,requiredWatchSeconds:watch,cooldownHours:cooldown,active:current?.active!==false,sortOrder:current?.sort_order||0})});setBusy(false);
  setNotice(r.ok?"Campanha salva.":"Falha ao salvar campanha.");if(r.ok){setSelected(null);await load()}
 };
 const toggle=async(row:AnyRow)=>{setBusy(true);const r=await fetch("/api/admin/rewards",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save_campaign",id:row.id,title:row.title,description:row.description,videoUrl:row.video_url,requiredWatchSeconds:row.required_watch_seconds,cooldownHours:row.cooldown_hours,active:!row.active,sortOrder:row.sort_order})});setBusy(false);if(r.ok)await load()};
 if(state==="loading")return <main className="crz-rewardmanager-state"><span className="crz-spinner"/><strong>Carregando Rewards...</strong></main>;
 if(state==="error"||!data)return <main className="crz-rewardmanager-state"><strong>Reward Manager indisponível.</strong><button onClick={()=>void load()}>Tentar novamente</button></main>;
 return <main className="crz-rewardmanager"><div className="crz-container">
  <PageHeader eyebrow="CRAZZY CLUB • FREE" title="FREE + Rewards" description="Campanhas grátis, tempo validado, testes e entregas em um só lugar." actions={<button className="crz-button crz-button--primary crz-button--sm" onClick={()=>void saveCampaign()} disabled={busy}>+ Campanha</button>}/>
  <section className="crz-rewardmanager-stats"><article><small>CAMPANHAS</small><strong>{data.campaigns.length}</strong><span>{data.campaigns.filter((x:AnyRow)=>x.active).length} ativas</span></article><article><small>SESSÕES</small><strong>{data.sessions.length}</strong><span>recentes</span></article><article className={pending.length?"is-alert":""}><small>PENDENTES</small><strong>{pending.length}</strong><span>concluídas/solicitadas</span></article><article><small>ENTREGAS</small><strong>{data.deliveries.length}</strong><span>recentes</span></article></section>
  {notice&&<p className="crz-rewardmanager-notice">{notice}</p>}
  <div className="crz-rewardmanager-layout">
   <section className="crz-rewardmanager-campaigns"><header><strong>Campanhas</strong></header>{data.campaigns.map((c:AnyRow)=><article key={c.id} onClick={()=>setSelected({kind:"campaign",row:c})}><div><span><Badge tone={c.active?"green":"neutral"}>{c.active?"ATIVA":"OFF"}</Badge><small>{c.required_watch_seconds}s • cooldown {c.cooldown_hours}h</small></span><strong>{c.title}</strong><p>{c.description}</p></div><button type="button" onClick={e=>{e.stopPropagation();void toggle(c)}}>{c.active?"Pausar":"Ativar"}</button></article>)}</section>
   <aside className="crz-rewardmanager-side"><section><header><strong>Sessões pedindo atenção</strong><Badge tone={pending.length?"gold":"green"}>{pending.length}</Badge></header>{pending.slice(0,20).map((s:AnyRow)=><div key={s.id}><span><strong>{s.customer?.username||s.user_id.slice(0,8)}</strong><small>{s.status} • {Math.round(Number(s.watched_seconds||0))}s</small></span><a href={"/admin/clientes?userId="+s.user_id}>Cliente →</a></div>)}{!pending.length&&<em>Nenhuma pendência.</em>}</section>
   <section><header><strong>Trial stock por plano</strong></header>{data.plans.filter((p:AnyRow)=>p.trial_stock.total>0).map((p:AnyRow)=><div key={p.id}><span><strong>{p.name}</strong><small>{p.plan_code||"plano"}</small></span><b>{p.trial_stock.available}/{p.trial_stock.total}</b></div>)}{!data.plans.some((p:AnyRow)=>p.trial_stock.total>0)&&<em>Sem trial stock cadastrado.</em>}</section></aside>
  </div>
 </div></main>
}
