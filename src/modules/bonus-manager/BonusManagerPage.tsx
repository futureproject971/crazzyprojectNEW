"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {PageHeader,Badge} from "@/core/design-system";
type Row=Record<string,any>;
type RuleDraft={planId:string;grant:string;accepts:boolean;percent:string;fixed:string;monthly:string;expiry:string};
const cents=(v:string)=>Math.max(0,Math.round(Number(String(v||"0").replace(",","."))*100));
export function BonusManagerPage(){
 const [data,setData]=useState<any>(null),[state,setState]=useState("loading"),[notice,setNotice]=useState(""),[draft,setDraft]=useState<RuleDraft|null>(null);
 const load=useCallback(async()=>{setState("loading");const r=await fetch("/api/admin/bonus",{cache:"no-store"});const p=await r.json().catch(()=>({}));if(!r.ok){setState("error");return}setData(p);setState("ready")},[]);
 useEffect(()=>{void load()},[load]);
 const rules=useMemo(()=>new Map((data?.rules||[]).map((r:Row)=>[r.plan_id,r])),[data]);
 const edit=(plan:Row)=>{const r=rules.get(plan.id) as Row|undefined;setDraft({planId:plan.id,grant:String(Number(r?.grant_bonus_cents||0)/100),accepts:r?.accepts_bonus===true,percent:String(r?.max_bonus_percent??30),fixed:String(Number(r?.max_bonus_cents||0)/100),monthly:String(Number(r?.monthly_limit_cents||0)/100),expiry:r?.expires_days?String(r.expires_days):""})};
 const save=async()=>{if(!draft)return;const r=await fetch("/api/admin/bonus",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save_rule",planId:draft.planId,grantBonusCents:cents(draft.grant),acceptsBonus:draft.accepts,maxBonusPercent:Math.min(90,Math.max(0,Number(draft.percent)||0)),maxBonusCents:cents(draft.fixed),monthlyLimitCents:cents(draft.monthly),expiresDays:draft.expiry?Number(draft.expiry):null,active:true})});setNotice(r.ok?"Regra salva.":"Falha ao salvar regra.");if(r.ok){setDraft(null);await load()}};
 if(state==="loading")return <main className="crz-bonusmanager-state"><span className="crz-spinner"/><strong>Carregando bônus...</strong></main>;
 if(state==="error"||!data)return <main className="crz-bonusmanager-state"><strong>CRAZZY BONUS indisponível.</strong><button onClick={()=>void load()}>Tentar novamente</button></main>;
 const plan=data.plans.find((p:Row)=>p.id===draft?.planId);
 return <main className="crz-bonusmanager"><div className="crz-container">
  <PageHeader eyebrow="CRAZZY CLUB • BÔNUS" title="Bônus e limites" description="Defina quanto cada plano gera e quanto pode ser usado. Para ajustar o saldo de uma pessoa, encontre o cliente no Customer 360." actions={<a className="crz-button crz-button--primary crz-button--sm" href="/admin/clientes">Buscar cliente</a>}/>
  {notice&&<p className="crz-bonusmanager-notice">{notice}</p>}
  <section className="crz-bonusmanager-stats"><article><small>CARTEIRAS</small><strong>{data.wallets.length}</strong></article><article><small>MOVIMENTAÇÕES</small><strong>{data.transactions.length}</strong></article><article><small>RESGATES</small><strong>{data.redemptions.length}</strong></article><article><small>PLANOS CONFIGURADOS</small><strong>{data.rules.length}</strong></article></section>
  {draft&&<section className="crz-bonusmanager-list"><header><strong>{plan?.products?.name||"Produto"} • {plan?.name||"Plano"}</strong><span>Configuração rápida</span></header><article style={{display:"grid",gap:10}}>
   <label><small>Bônus gerado na compra (R$)</small><input value={draft.grant} onChange={e=>setDraft({...draft,grant:e.target.value})}/></label>
   <label><small>Usar bônus neste plano</small><button type="button" onClick={()=>setDraft({...draft,accepts:!draft.accepts})}>{draft.accepts?"SIM • ACEITA BÔNUS":"NÃO • SEM RESGATE"}</button></label>
   <label><small>Máximo do preço pago com bônus (%)</small><input type="number" min="0" max="90" value={draft.percent} onChange={e=>setDraft({...draft,percent:e.target.value})}/></label>
   <label><small>Teto por compra (R$)</small><input value={draft.fixed} onChange={e=>setDraft({...draft,fixed:e.target.value})}/></label>
   <label><small>Limite mensal por cliente (R$)</small><input value={draft.monthly} onChange={e=>setDraft({...draft,monthly:e.target.value})}/></label>
   <label><small>Validade do bônus em dias</small><input type="number" min="1" value={draft.expiry} placeholder="Sem expiração" onChange={e=>setDraft({...draft,expiry:e.target.value})}/></label>
   <div><button onClick={()=>setDraft(null)}>Cancelar</button> <button className="crz-button crz-button--primary crz-button--sm" onClick={()=>void save()}>Salvar regra</button></div>
  </article></section>}
  <section className="crz-bonusmanager-list"><header><strong>Regras por plano</strong><span>sem IDs técnicos</span></header>{data.plans.map((p:Row)=>{const r=rules.get(p.id) as Row|undefined;return <article key={p.id}><span><small>{p.products?.name||"Produto"}</small><strong>{p.name}</strong><em>R$ {Number(p.price).toFixed(2)}</em></span><span><Badge tone={r?.active?"green":"neutral"}>{r?.accepts_bonus?"ACEITA BÔNUS":"SEM RESGATE"}</Badge><small>gera R$ {(Number(r?.grant_bonus_cents||0)/100).toFixed(2)} • máx {Number(r?.max_bonus_percent??30)}%</small></span><button onClick={()=>edit(p)}>Editar</button></article>})}</section>
 </div></main>
}