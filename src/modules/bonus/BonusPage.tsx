"use client";
import {ActivityXp} from "./ActivityXp";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, NeonIcon } from "@/core/design-system";
import { useAuth } from "@/modules/auth/AuthProvider";
import { useCart } from "@/modules/cart/CartProvider";

type Row=Record<string,any>;
const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(c)||0)/100);

export function BonusPage(){
  const {user,loading:authLoading}=useAuth();
  const {setCouponCode}=useCart();
  const [data,setData]=useState<Row|null>(null),[state,setState]=useState("loading"),[notice,setNotice]=useState("");
  const [amounts,setAmounts]=useState<Record<string,string>>({});
  const load=useCallback(async()=>{
    if(!user){setState("ready");setData(null);return}
    setState("loading");
    const r=await fetch("/api/bonus",{cache:"no-store"});const p=await r.json().catch(()=>({}));
    if(!r.ok){setNotice(p.error||"Carteira indisponível.");setState("error");return}
    setData(p);setState("ready");
  },[user]);
  useEffect(()=>{if(!authLoading)void load()},[authLoading,load]);

  const balance=Number(data?.wallet?.balance_cents||0);
  const plans=useMemo(()=>(data?.plans||[]).filter((p:Row)=>p.accepts_bonus),[data]);

  const redeem=async(plan:Row)=>{
    const reais=Number(String(amounts[plan.plan_id]||"").replace(",","."));
    const amountCents=Math.round(reais*100);
    if(!amountCents)return setNotice("Informe quanto CRAZZY BONUS deseja usar.");
    const r=await fetch("/api/bonus",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"redeem",planId:plan.plan_id,amountCents,idempotencyKey:"redeem:"+crypto.randomUUID()})});
    const p=await r.json().catch(()=>({}));
    if(!r.ok)return setNotice(p.error||"Não foi possível resgatar.");
    setCouponCode(String(p.coupon_code||""));
    setNotice("Cupom "+p.coupon_code+" criado e aplicado ao carrinho. Válido por 24h para o plano escolhido.");
    await load();
  };

  if(authLoading||state==="loading")return <main className="crz-bonus-page"><div className="crz-container crz-bonus-state"><span className="crz-spinner"/><strong>Carregando CRAZZY BONUS...</strong></div></main>;
  if(!user)return <main className="crz-bonus-page"><div className="crz-container"><PageHeader eyebrow="CRAZZY BONUS" title="Sua carteira promocional" description="Entre com Discord para consultar e usar seus benefícios." actions={<a className="crz-button crz-button--primary crz-button--sm" href="/login">Entrar com Discord</a>}/></div></main>;

  return <main className="crz-bonus-page"><div className="crz-container">
    <PageHeader eyebrow="CRAZZY BONUS" title="Carteira promocional" description="Bônus de compras e recompensas. Não é sacável, não é transferível e só pode ser usado nos planos elegíveis." actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/club/luck">Abrir CRAZZY ARCADE</a>}/>
    {notice&&<div className="crz-bonus-notice">{notice}</div>}
    <ActivityXp/>
    <section className="crz-bonus-balance"><div><small>SALDO DISPONÍVEL</small><strong>{money(balance)}</strong><span>CRAZZY BONUS</span></div><NeonIcon name="crown" size={70}/></section>
    <section className="crz-bonus-grid">
      <article><header><strong>Usar na loja</strong><span>{plans.length} plano(s) elegível(is)</span></header>
        <div className="crz-bonus-plans">{plans.map((p:Row)=>{
          const price=Number(p.price_cents||0),pct=Math.floor(price*(Number(p.max_bonus_percent||0)/100));
          const fixed=Number(p.max_bonus_cents||0)>0?Number(p.max_bonus_cents):pct;
          const max=Math.max(0,Math.min(balance,pct,fixed,price-80));
          const monthlyLeft=Number(p.monthly_limit_cents||0)>0?Math.max(0,Number(p.monthly_limit_cents)-Number(p.monthly_used_cents||0)):max;
          const allowed=Math.min(max,monthlyLeft);
          return <div className="crz-bonus-plan" key={p.plan_id}><div><small>{p.product_name}</small><strong>{p.plan_name}</strong><span>Plano {money(price)} • pode usar até {money(allowed)}</span></div><div className="crz-bonus-plan__redeem"><input inputMode="decimal" placeholder="R$ 0,00" value={amounts[p.plan_id]||""} onChange={e=>setAmounts(v=>({...v,[p.plan_id]:e.target.value}))}/><button disabled={allowed<=0} onClick={()=>void redeem(p)}>Gerar benefício</button></div></div>
        })}{!plans.length&&<p>Nenhum plano aceita CRAZZY BONUS ainda. O admin pode liberar por produto/plano.</p>}</div>
      </article>
      <article><header><strong>Extrato</strong><span>últimos movimentos</span></header><div className="crz-bonus-ledger">{(data?.wallet?.transactions||[]).map((t:Row)=><div key={t.id}><span><b>{t.description||t.source_type}</b><small>{new Date(t.created_at).toLocaleString("pt-BR")}</small></span><strong className={t.direction==="credit"?"is-credit":"is-debit"}>{t.direction==="credit"?"+":"-"}{money(t.amount_cents)}</strong></div>)}{!(data?.wallet?.transactions||[]).length&&<p>Seu extrato ainda está vazio.</p>}</div></article>
    </section>
    <div className="crz-bonus-rules"><NeonIcon name="shield" size={24}/><span>CRAZZY BONUS é promocional. Cada plano pode ter percentual máximo, teto em reais, limite mensal e validade próprios, sempre exibidos antes do resgate.</span></div>
  </div></main>;
}