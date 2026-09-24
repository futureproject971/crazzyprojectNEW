"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Dialog, PageHeader } from "@/core/design-system";

type Row=Record<string,any>;
type CampaignForm={id?:string;title:string;mode:string;cost:string;active:boolean;slug?:string;description?:string;sortOrder:number};
type PrizeForm={id?:string;label:string;prizeType:string;weight:string;stock:string;bonusValue:string;discountType:string;discountValue:string;minOrderValue:string;expiresHours:string;productId:string;productPlanId:string;durationMinutes:string;note:string;sortOrder:number};

const money=(c:number)=>"R$ "+((Number(c)||0)/100).toFixed(2);
const emptyPrize=():PrizeForm=>({label:"",prizeType:"bonus",weight:"10",stock:"",bonusValue:"0",discountType:"percentage",discountValue:"10",minOrderValue:"0",expiresHours:"72",productId:"",productPlanId:"",durationMinutes:"0",note:"",sortOrder:0});

export function LuckManagerPage(){
 const [data,setData]=useState<any>(null);
 const [state,setState]=useState("loading");
 const [campaign,setCampaign]=useState<Row|null>(null);
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [campaignForm,setCampaignForm]=useState<CampaignForm|null>(null);
 const [prizeForm,setPrizeForm]=useState<PrizeForm|null>(null);

 const load=useCallback(async()=>{try{const r=await fetch("/api/admin/luck",{cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error();setData(p);setState("ready")}catch{setState("error")}},[]);
 useEffect(()=>{void load()},[load]);
 const prizes=useMemo(()=>campaign?data?.prizes?.filter((p:Row)=>p.campaign_id===campaign.id)||[]:[],[campaign,data]);

 const openCampaign=(row?:Row)=>setCampaignForm({
  id:row?.id,
  title:row?.title||"",
  mode:row?.mode||"scratch",
  cost:String(Number(row?.bonus_cost_cents||0)/100),
  active:row?.active!==false,
  slug:row?.slug,
  description:row?.description||"",
  sortOrder:row?.sort_order||0,
 });

 const openPrize=(row?:Row)=>{
  if(!campaign)return;
  setPrizeForm({
   ...emptyPrize(),
   id:row?.id,
   label:row?.label||"",
   prizeType:row?.prize_type||"bonus",
   weight:String(row?.weight||10),
   stock:row?.stock_limit==null?"":String(row.stock_limit),
   bonusValue:String(Number(row?.config?.bonus_cents||0)/100),
   discountType:row?.config?.discount_type||"percentage",
   discountValue:String(row?.config?.discount_value||10),
   minOrderValue:String(row?.config?.min_order_value||0),
   expiresHours:String(row?.config?.expires_hours||72),
   productId:row?.config?.product_id||"",
   productPlanId:row?.config?.product_plan_id||"",
   durationMinutes:String(row?.config?.duration_minutes||0),
   note:row?.config?.note||"",
   sortOrder:row?.sort_order||0,
  });
 };

 const saveCampaign=async()=>{
  if(!campaignForm?.title.trim())return setNotice("Informe um nome para a campanha.");
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/admin/luck",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    action:"save_campaign",id:campaignForm.id,title:campaignForm.title.trim(),slug:campaignForm.slug,mode:campaignForm.mode,
    description:campaignForm.description||"",bonusCostCents:Math.round(Number(campaignForm.cost.replace(",","."))*100),
    active:campaignForm.active,sortOrder:campaignForm.sortOrder
   })});
   setNotice(r.ok?"Campanha salva com sucesso.":"Não foi possível salvar a campanha.");
   if(r.ok){setCampaignForm(null);await load()}
  }finally{setBusy(false)}
 };

 const savePrize=async()=>{
  if(!campaign||!prizeForm?.label.trim())return setNotice("Informe um nome para o prêmio.");
  setBusy(true);setNotice("");
  try{
   const body:any={action:"save_prize",id:prizeForm.id,campaignId:campaign.id,label:prizeForm.label.trim(),prizeType:prizeForm.prizeType,weight:Number(prizeForm.weight)||0,active:true,stockLimit:prizeForm.stock.trim()?Number(prizeForm.stock):null,sortOrder:prizeForm.sortOrder};
   if(prizeForm.prizeType==="bonus")body.bonusCents=Math.round(Number(prizeForm.bonusValue.replace(",","."))*100);
   else if(prizeForm.prizeType==="coupon"){body.discountType=prizeForm.discountType;body.discountValue=Number(prizeForm.discountValue);body.minOrderValue=Number(prizeForm.minOrderValue);body.expiresHours=Number(prizeForm.expiresHours)}
   else if(prizeForm.prizeType==="product"){body.productId=prizeForm.productId;body.productPlanId=prizeForm.productPlanId;body.durationMinutes=Number(prizeForm.durationMinutes)}
   else if(prizeForm.prizeType==="reward")body.note=prizeForm.note;
   const r=await fetch("/api/admin/luck",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   setNotice(r.ok?"Prêmio salvo com sucesso.":"Não foi possível salvar o prêmio.");
   if(r.ok){setPrizeForm(null);await load()}
  }finally{setBusy(false)}
 };

 if(state==="loading")return <main className="crz-luckmanager-state"><span className="crz-spinner"/><strong>Carregando Arcade...</strong></main>;
 if(state==="error"||!data)return <main className="crz-luckmanager-state"><strong>Arcade Manager indisponível.</strong><button onClick={()=>void load()}>Tentar novamente</button></main>;

 return <main className="crz-luckmanager"><div className="crz-container">
  <PageHeader eyebrow="CRAZZY ARCADE MANAGER" title="Prêmios e custo em CRAZZY BONUS" description="Configure campanhas e prêmios dentro do painel. Nenhuma jogada usa PIX direto: o servidor debita o bônus, sorteia, registra e entrega." actions={<button className="crz-button crz-button--primary crz-button--md" onClick={()=>openCampaign()}>+ Nova campanha</button>}/>
  {notice&&<p className="crz-luckmanager-notice">{notice}</p>}
  <div className="crz-luckmanager-layout">
   <section className="crz-luckmanager-campaigns">
    <header><div><strong>Campanhas</strong><small>Selecione uma campanha para ver e editar os prêmios.</small></div></header>
    {data.campaigns.map((c:Row)=><button type="button" key={c.id} className={campaign?.id===c.id?"is-selected":""} onClick={()=>setCampaign(c)}>
     <span><strong>{c.title}</strong><small>{c.mode} • {money(c.bonus_cost_cents)} BONUS por jogada</small></span>
     <Badge tone={c.active&&c.bonus_cost_cents>0?"green":"neutral"}>{c.active&&c.bonus_cost_cents>0?"ATIVA":"CONFIGURAR"}</Badge>
     <em onClick={e=>{e.stopPropagation();openCampaign(c)}}>Editar</em>
    </button>)}
   </section>
   <aside className="crz-luckmanager-prizes">
    <header><div><strong>{campaign?.title||"Selecione uma campanha"}</strong><small>{campaign?prizes.length+" prêmios cadastrados":"Escolha uma campanha à esquerda."}</small></div>{campaign&&<button onClick={()=>openPrize()}>+ Novo prêmio</button>}</header>
    {prizes.map((p:Row)=><article key={p.id}><span><strong>{p.label}</strong><small>{p.prize_type} • estoque {p.stock_limit==null?"∞":Math.max(0,p.stock_limit-p.wins_count)+"/"+p.stock_limit}</small></span><span><Badge tone={p.active?"green":"neutral"}>{p.weight} peso</Badge><small>{p.wins_count} vitória(s)</small></span><button onClick={()=>openPrize(p)}>Editar</button></article>)}
    {campaign&&prizes.length===0&&<div className="crz-luckmanager-empty">Nenhum prêmio nesta campanha. Clique em “Novo prêmio”.</div>}
   </aside>
  </div>

  <Dialog open={Boolean(campaignForm)} title={campaignForm?.id?"Editar campanha":"Nova campanha"} onClose={()=>!busy&&setCampaignForm(null)}>
   {campaignForm&&<form className="crz-admin-form" onSubmit={e=>{e.preventDefault();void saveCampaign()}}>
    <label><span>Nome da campanha</span><small>É o nome que você verá no painel.</small><input className="crz-input" value={campaignForm.title} onChange={e=>setCampaignForm({...campaignForm,title:e.target.value})} placeholder="Ex.: Roleta CRAZZY"/></label>
    <label><span>Tipo de experiência</span><small>Escolha como o cliente joga.</small><select className="crz-select" value={campaignForm.mode} onChange={e=>setCampaignForm({...campaignForm,mode:e.target.value})}><option value="wheel">Roleta</option><option value="scratch">Raspadinha</option><option value="drop">CRAZZY DROP</option></select></label>
    <label><span>Custo por jogada em BONUS</span><small>Valor em reais debitado da carteira promocional. Use 0 para campanha gratuita.</small><input className="crz-input" inputMode="decimal" value={campaignForm.cost} onChange={e=>setCampaignForm({...campaignForm,cost:e.target.value})} placeholder="0,00"/></label>
    <label className="crz-admin-switch"><input type="checkbox" checked={campaignForm.active} onChange={e=>setCampaignForm({...campaignForm,active:e.target.checked})}/><span><strong>Campanha ativa</strong><small>Quando desligada, o cliente não consegue jogar.</small></span></label>
    <div className="crz-admin-form__actions"><button type="button" className="crz-button crz-button--secondary crz-button--md" onClick={()=>setCampaignForm(null)} disabled={busy}>Cancelar</button><button type="submit" className="crz-button crz-button--primary crz-button--md" disabled={busy}>{busy?"Salvando...":"Salvar campanha"}</button></div>
   </form>}
  </Dialog>

  <Dialog open={Boolean(prizeForm)} title={prizeForm?.id?"Editar prêmio":"Novo prêmio"} onClose={()=>!busy&&setPrizeForm(null)}>
   {prizeForm&&<form className="crz-admin-form" onSubmit={e=>{e.preventDefault();void savePrize()}}>
    <label><span>Nome do prêmio</span><small>Texto que identifica o prêmio no painel e no resultado.</small><input className="crz-input" value={prizeForm.label} onChange={e=>setPrizeForm({...prizeForm,label:e.target.value})} placeholder="Ex.: 10% OFF"/></label>
    <label><span>Tipo de prêmio</span><small>Define o que o servidor entrega depois do sorteio.</small><select className="crz-select" value={prizeForm.prizeType} onChange={e=>setPrizeForm({...prizeForm,prizeType:e.target.value})}><option value="bonus">CRAZZY BONUS</option><option value="coupon">Cupom</option><option value="product">Produto</option><option value="reward">Entrega manual</option><option value="none">Sem prêmio</option></select></label>
    <div className="crz-admin-form__grid"><label><span>Peso</span><small>Chance relativa entre os prêmios.</small><input className="crz-input" inputMode="numeric" value={prizeForm.weight} onChange={e=>setPrizeForm({...prizeForm,weight:e.target.value})}/></label><label><span>Estoque máximo</span><small>Deixe vazio para ilimitado.</small><input className="crz-input" inputMode="numeric" value={prizeForm.stock} onChange={e=>setPrizeForm({...prizeForm,stock:e.target.value})} placeholder="Ilimitado"/></label></div>
    {prizeForm.prizeType==="bonus"&&<label><span>Valor em CRAZZY BONUS</span><small>Valor creditado na carteira promocional.</small><input className="crz-input" inputMode="decimal" value={prizeForm.bonusValue} onChange={e=>setPrizeForm({...prizeForm,bonusValue:e.target.value})}/></label>}
    {prizeForm.prizeType==="coupon"&&<><label><span>Formato do desconto</span><small>Percentual ou valor fixo.</small><select className="crz-select" value={prizeForm.discountType} onChange={e=>setPrizeForm({...prizeForm,discountType:e.target.value})}><option value="percentage">Percentual</option><option value="fixed">Valor fixo</option></select></label><div className="crz-admin-form__grid"><label><span>Valor</span><input className="crz-input" value={prizeForm.discountValue} onChange={e=>setPrizeForm({...prizeForm,discountValue:e.target.value})}/></label><label><span>Pedido mínimo</span><input className="crz-input" value={prizeForm.minOrderValue} onChange={e=>setPrizeForm({...prizeForm,minOrderValue:e.target.value})}/></label></div><label><span>Validade em horas</span><input className="crz-input" value={prizeForm.expiresHours} onChange={e=>setPrizeForm({...prizeForm,expiresHours:e.target.value})}/></label></>}
    {prizeForm.prizeType==="product"&&<><label><span>ID do produto</span><small>UUID do produto que será liberado.</small><input className="crz-input" value={prizeForm.productId} onChange={e=>setPrizeForm({...prizeForm,productId:e.target.value})}/></label><label><span>ID do plano</span><small>Opcional. Deixe vazio quando o prêmio não exigir plano específico.</small><input className="crz-input" value={prizeForm.productPlanId} onChange={e=>setPrizeForm({...prizeForm,productPlanId:e.target.value})}/></label><label><span>Duração em minutos</span><small>Use 0 para não expirar.</small><input className="crz-input" value={prizeForm.durationMinutes} onChange={e=>setPrizeForm({...prizeForm,durationMinutes:e.target.value})}/></label></>}
    {prizeForm.prizeType==="reward"&&<label><span>Instrução de entrega</span><small>Explique o que a equipe precisa entregar manualmente.</small><textarea className="crz-admin-textarea" rows={4} value={prizeForm.note} onChange={e=>setPrizeForm({...prizeForm,note:e.target.value})}/></label>}
    <div className="crz-admin-form__actions"><button type="button" className="crz-button crz-button--secondary crz-button--md" onClick={()=>setPrizeForm(null)} disabled={busy}>Cancelar</button><button type="submit" className="crz-button crz-button--primary crz-button--md" disabled={busy}>{busy?"Salvando...":"Salvar prêmio"}</button></div>
   </form>}
  </Dialog>
 </div></main>
}
