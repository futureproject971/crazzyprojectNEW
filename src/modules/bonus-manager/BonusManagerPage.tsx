"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Badge } from "@/core/design-system";
type Row=Record<string,any>;
const toCents=(v:string|null)=>Math.max(0,Math.round(Number(String(v||"0").replace(",","."))*100));

export function BonusManagerPage(){
 const [data,setData]=useState<any>(null),[state,setState]=useState("loading"),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{setState("loading");const r=await fetch("/api/admin/bonus",{cache:"no-store"});const p=await r.json().catch(()=>({}));if(!r.ok){setState("error");return}setData(p);setState("ready")},[]);
 useEffect(()=>{void load()},[load]);
 const rules=useMemo(()=>new Map((data?.rules||[]).map((r:Row)=>[r.plan_id,r])),[data]);
 const saveRule=async(plan:Row)=>{
   const current=rules.get(plan.id) as Row|undefined;
   const grant=window.prompt("Bônus gerado pela compra deste plano (R$):",String(Number(current?.grant_bonus_cents||0)/100));if(grant===null)return;
   const accepts=window.confirm("Este plano aceita CRAZZY BONUS como desconto? OK = sim");
   const percent=window.prompt("Percentual máximo do preço que pode ser pago com BONUS (0-90):",String(current?.max_bonus_percent??30));if(percent===null)return;
   const fixed=window.prompt("Teto fixo de BONUS por resgate em R$ (0 = só percentual):",String(Number(current?.max_bonus_cents||0)/100));if(fixed===null)return;
   const monthly=window.prompt("Limite mensal por usuário neste plano em R$ (0 = sem teto mensal):",String(Number(current?.monthly_limit_cents||0)/100));if(monthly===null)return;
   const expiry=window.prompt("Validade do bônus gerado em dias (vazio = não expira):",current?.expires_days?String(current.expires_days):"");
   const r=await fetch("/api/admin/bonus",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save_rule",planId:plan.id,grantBonusCents:toCents(grant),acceptsBonus:accepts,maxBonusPercent:Number(percent),maxBonusCents:toCents(fixed),monthlyLimitCents:toCents(monthly),expiresDays:expiry?Number(expiry):null,active:true})});
   setNotice(r.ok?"Regra salva.":"Falha ao salvar regra.");if(r.ok)await load();
 };
 const adjust=async()=>{
   const userId=window.prompt("UUID do usuário:");if(!userId)return;
   const amount=window.prompt("Ajuste em R$ (positivo credita, negativo debita):");if(!amount)return;
   const cents=Math.round(Number(amount.replace(",","."))*100);if(!cents)return;
   const description=window.prompt("Descrição:","Ajuste manual CRAZZY BONUS")||"Ajuste manual CRAZZY BONUS";
   const r=await fetch("/api/admin/bonus",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"adjust",userId,amountCents:cents,description,idempotencyKey:"admin:"+crypto.randomUUID()})});
   setNotice(r.ok?"Saldo ajustado.":"Não foi possível ajustar.");if(r.ok)await load();
 };
 if(state==="loading")return <main className="crz-bonusmanager-state"><span className="crz-spinner"/><strong>Carregando BONUS...</strong></main>;
 if(state==="error"||!data)return <main className="crz-bonusmanager-state"><strong>Bonus Manager indisponível.</strong><button onClick={()=>void load()}>Tentar novamente</button></main>;
 return <main className="crz-bonusmanager"><div className="crz-container">
  <PageHeader eyebrow="CRAZZY BONUS MANAGER" title="Carteira, planos e limites" description="Configure quanto cada plano gera, onde o saldo pode ser usado e os limites mensais." actions={<button className="crz-button crz-button--primary crz-button--sm" onClick={()=>void adjust()}>Ajustar saldo</button>}/>
  {notice&&<p className="crz-bonusmanager-notice">{notice}</p>}
  <section className="crz-bonusmanager-stats"><article><small>CARTEIRAS</small><strong>{data.wallets.length}</strong></article><article><small>TRANSAÇÕES</small><strong>{data.transactions.length}</strong></article><article><small>RESGATES</small><strong>{data.redemptions.length}</strong></article><article><small>REGRAS</small><strong>{data.rules.length}</strong></article></section>
  <section className="crz-bonusmanager-list"><header><strong>Regras por plano</strong><span>clique em editar</span></header>{data.plans.map((p:Row)=>{const r=rules.get(p.id) as Row|undefined;return <article key={p.id}><span><small>{p.products?.name||p.product_id}</small><strong>{p.name}</strong><em>R$ {Number(p.price).toFixed(2)}</em></span><span><Badge tone={r?.active?"green":"neutral"}>{r?.accepts_bonus?"ACEITA BONUS":"SEM RESGATE"}</Badge><small>gera R$ {(Number(r?.grant_bonus_cents||0)/100).toFixed(2)} • máx {Number(r?.max_bonus_percent??30)}%</small></span><button onClick={()=>void saveRule(p)}>Editar</button></article>})}</section>
 </div></main>
}