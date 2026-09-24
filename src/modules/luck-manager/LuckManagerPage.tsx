"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";
type Row=Record<string,any>;

export function LuckManagerPage(){
 const [data,setData]=useState<any>(null),[state,setState]=useState<"loading"|"ready"|"error">("loading"),[campaign,setCampaign]=useState<Row|null>(null),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{try{const r=await fetch("/api/admin/luck",{cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error();setData(p);setState("ready")}catch{setState("error")}},[]);
 useEffect(()=>{void load()},[]);
 const prizes=useMemo(()=>campaign?data?.prizes?.filter((p:Row)=>p.campaign_id===campaign.id)||[]:[],[campaign,data]);
 const saveCampaign=async(row?:Row)=>{
  const title=window.prompt("Título:",row?.title||"");if(!title)return;
  const mode=window.prompt("Modo: wheel, scratch ou drop",row?.mode||"wheel")||"";
  const free=Number(window.prompt("Jogadas grátis por dia:",String(row?.free_plays_per_day??1)));
  const price=Number(window.prompt("Preço por jogada em centavos (0 = grátis):",String(row?.play_price_cents??0)));
  const active=window.confirm(row?.active===false?"Ativar esta campanha?":"Manter esta campanha ativa? OK = ativa / Cancelar = desativada");
  const r=await fetch("/api/admin/luck",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save_campaign",id:row?.id,title,slug:row?.slug,mode,description:row?.description||"",freePlaysPerDay:free,playPriceCents:price,active,dailyGroup:row?.daily_group||"daily-luck",sortOrder:row?.sort_order||0})});
  setNotice(r.ok?"Campanha salva.":"Falha ao salvar campanha.");if(r.ok)await load();
 };
 const savePrize=async(row?:Row)=>{
  if(!campaign)return;
  const label=window.prompt("Nome do prêmio:",row?.label||"10% OFF");if(!label)return;
  const weight=Number(window.prompt("Peso/chance relativa:",String(row?.weight||10)));
  const discountType=window.prompt("Tipo: percentage ou fixed",row?.config?.discount_type||"percentage")||"";
  const discountValue=Number(window.prompt("Valor do desconto:",String(row?.config?.discount_value||10)));
  const minOrder=Number(window.prompt("Pedido mínimo em R$:",String(row?.config?.min_order_value||0)));
  const expiresHours=Number(window.prompt("Validade do cupom em horas:",String(row?.config?.expires_hours||72)));
  const stockRaw=window.prompt("Limite de estoque (vazio = infinito):",row?.stock_limit==null?"":String(row.stock_limit));
  const stockLimit=stockRaw?.trim()?Number(stockRaw):null;
  const active=window.confirm(row?.active===false?"Ativar este prêmio?":"Manter este prêmio ativo? OK = ativo / Cancelar = desativado");
  const r=await fetch("/api/admin/luck",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save_prize",id:row?.id,campaignId:campaign.id,label,prizeType:"coupon",weight,active,stockLimit,sortOrder:row?.sort_order||0,discountType,discountValue,minOrderValue:minOrder,expiresHours})});
  setNotice(r.ok?"Prêmio salvo.":"Falha ao salvar prêmio.");if(r.ok)await load();
 };
 if(state==="loading")return <main className="crz-luckmanager-state"><span className="crz-spinner"/><strong>Carregando Luck...</strong></main>;
 if(state==="error"||!data)return <main className="crz-luckmanager-state"><strong>Luck Manager indisponível.</strong><button onClick={()=>void load()}>Tentar novamente</button></main>;
 const pending=data.awards.filter((x:Row)=>x.status==="pending").length;
 return <main className="crz-luckmanager"><div className="crz-container">
  <PageHeader eyebrow="M37 • LUCK MANAGER" title="Chance no servidor, configuração no painel" description="O navegador nunca escolhe o prêmio. Aqui você controla campanhas, pesos e cupons; o motor server-side decide o resultado." actions={<button className="crz-button crz-button--primary crz-button--sm" onClick={()=>void saveCampaign()}>+ Campanha</button>}/>
  <section className="crz-luckmanager-stats"><article><small>CAMPANHAS</small><strong>{data.campaigns.length}</strong></article><article><small>PRÊMIOS</small><strong>{data.prizes.length}</strong></article><article><small>JOGADAS</small><strong>{data.plays.length}</strong></article><article className={pending?"is-alert":""}><small>PENDENTES</small><strong>{pending}</strong></article></section>
  {notice&&<p className="crz-luckmanager-notice">{notice}</p>}
  <div className="crz-luckmanager-layout">
   <section className="crz-luckmanager-campaigns"><header><strong>Campanhas</strong></header>{data.campaigns.map((c:Row)=><button type="button" key={c.id} className={campaign?.id===c.id?"is-selected":""} onClick={()=>setCampaign(c)}><span><strong>{c.title}</strong><small>{c.mode} • {c.free_plays_per_day}/dia • grupo {c.daily_group}</small></span><Badge tone={c.active?"green":"neutral"}>{c.active?"ATIVA":"OFF"}</Badge><em onClick={e=>{e.stopPropagation();void saveCampaign(c)}}>Editar</em></button>)}</section>
   <aside className="crz-luckmanager-prizes"><header><div><strong>{campaign?.title||"Selecione uma campanha"}</strong><small>{campaign?prizes.length+" prêmios":"—"}</small></div>{campaign&&<button onClick={()=>void savePrize()}>+ Prêmio</button>}</header>
    {prizes.map((p:Row)=><article key={p.id}><span><strong>{p.label}</strong><small>{p.config?.discount_type} {p.config?.discount_value} • vence em {p.config?.expires_hours}h • estoque {p.stock_limit==null?"∞":Math.max(0,p.stock_limit-p.wins_count)+"/"+p.stock_limit}</small></span><span><Badge tone={p.active?"green":"neutral"}>{p.weight} peso</Badge><small>{p.wins_count} vitória(s)</small></span><button onClick={()=>void savePrize(p)}>Editar</button></article>)}
    {campaign&&!prizes.length&&<div className="crz-luckmanager-empty">Sem prêmios.</div>}
   </aside>
  </div>
 </div></main>
}
