"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";
import type {ResellerAdminPayload,ResellerAdminRow} from "./types";

function money(value:number){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value)||0)}
function date(value:string|null|undefined){if(!value)return"Sem validade";const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("pt-BR")}

export function ResellerManagerPage(){
  const [data,setData]=useState<ResellerAdminPayload|null>(null);
  const [state,setState]=useState<"loading"|"ready"|"auth"|"forbidden"|"error">("loading");
  const [selected,setSelected]=useState<ResellerAdminRow|null>(null);
  const [query,setQuery]=useState("");
  const [userId,setUserId]=useState("");
  const [discount,setDiscount]=useState("50");
  const [active,setActive]=useState(true);
  const [expiresAt,setExpiresAt]=useState("");
  const [notes,setNotes]=useState("");
  const [productIds,setProductIds]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    try{
      const response=await fetch("/api/admin/resellers",{cache:"no-store"});
      if(response.status===401)return setState("auth");
      if(response.status===403)return setState("forbidden");
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!Array.isArray(payload.resellers))throw new Error();
      setData(payload as ResellerAdminPayload);
      setState("ready");
    }catch{setState("error")}
  },[]);

  useEffect(()=>{void load()},[]);

  const choose=(item:ResellerAdminRow)=>{
    setSelected(item);setUserId(item.user_id);setDiscount(String(item.discount_percent));
    setActive(item.active);setExpiresAt(item.expires_at?item.expires_at.slice(0,10):"");
    setNotes(item.notes||"");setProductIds(item.product_ids||[]);setNotice("");
  };
  const fresh=()=>{setSelected(null);setUserId("");setDiscount("50");setActive(true);setExpiresAt("");setNotes("");setProductIds([]);setNotice("")};

  const save=async()=>{
    if(busy)return;
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/admin/resellers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        userId,discountPercent:Number(discount),active,expiresAt:expiresAt?expiresAt+"T23:59:59-03:00":null,notes,productIds
      })});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||"SAVE_FAILED");
      setNotice("Revendedor salvo.");
      await load();
      fresh();
    }catch(error){setNotice(error instanceof Error?"Falha: "+error.message:"Não foi possível salvar.")}
    finally{setBusy(false)}
  };

  const visible=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return(data?.resellers||[]).filter(item=>!q||(item.customer.discord_username||"").toLowerCase().includes(q)||(item.customer.username||"").toLowerCase().includes(q)||item.user_id.includes(q));
  },[data,query]);

  if(state==="loading"&&!data)return <main className="crz-resellers-state"><span className="crz-spinner"/><strong>Carregando revendedores...</strong></main>;
  if(state==="auth")return <main className="crz-resellers-state"><strong>Entre para continuar.</strong></main>;
  if(state==="forbidden")return <main className="crz-resellers-state"><strong>Acesso de administrador necessário.</strong></main>;
  if(state==="error"||!data)return <main className="crz-resellers-state"><strong>Resellers indisponível.</strong><button onClick={()=>void load()}>Tentar novamente</button></main>;

  return <main className="crz-resellers"><div className="crz-container crz-resellers__container">
    <PageHeader eyebrow="M34 • RESELLERS" title="Revendedores sem planilha paralela" description="Desconto, validade, catálogo permitido e histórico ficam ligados à conta CRAZZY." actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/revendedor">Ver área do revendedor</a>}/>

    <section className="crz-resellers-summary">
      <article><small>TOTAL</small><strong>{data.resellers.length}</strong><span>cadastrados</span></article>
      <article><small>ATIVOS</small><strong>{data.resellers.filter(x=>x.active&&(!x.expires_at||new Date(x.expires_at)>new Date())).length}</strong><span>elegíveis</span></article>
      <article><small>COMPRAS</small><strong>{data.resellers.reduce((s,x)=>s+x.purchase_count,0)}</strong><span>registradas</span></article>
      <article><small>VOLUME</small><strong>{money(data.resellers.reduce((s,x)=>s+x.purchase_total,0))}</strong><span>preço reseller</span></article>
    </section>

    <div className="crz-resellers-layout">
      <section className="crz-resellers-list">
        <header><label>⌕ <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Discord, usuário ou UUID..."/></label><button onClick={fresh}>+ Novo</button></header>
        {visible.map(item=><button key={item.id} className={selected?.id===item.id?"is-selected":""} onClick={()=>choose(item)}>
          <span><strong>{item.customer.discord_username||item.customer.username||item.user_id.slice(0,8)}</strong><small>{item.customer.guild_member?"✓ Discord":"Discord não verificado"} • {item.product_ids.length} produto(s)</small></span>
          <span><Badge tone={item.active?"green":"neutral"}>{item.active?"ATIVO":"OFF"}</Badge><strong>{item.discount_percent}%</strong><small>{date(item.expires_at)}</small></span>
        </button>)}
        {!visible.length&&<div className="crz-resellers-empty">Nenhum revendedor encontrado.</div>}
      </section>

      <aside className="crz-resellers-editor">
        <header><div><small>{selected?"EDITAR":"NOVO REVENDEDOR"}</small><h2>{selected?.customer.discord_username||selected?.customer.username||"Configuração"}</h2></div>{selected&&<a href={"/admin/clientes?userId="+encodeURIComponent(selected.user_id)}>Customer 360 →</a>}</header>
        <label><span>User UUID</span><input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="UUID do cliente"/></label>
        <div className="crz-resellers-editor__row">
          <label><span>Desconto %</span><input type="number" min="0" max="80" step="0.5" value={discount} onChange={e=>setDiscount(e.target.value)}/></label>
          <label><span>Validade</span><input type="date" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)}/></label>
        </div>
        <label className="crz-resellers-toggle"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/><span>Revendedor ativo</span></label>
        <label><span>Observações internas</span><textarea value={notes} onChange={e=>setNotes(e.target.value.slice(0,1000))}/></label>
        <section className="crz-resellers-products">
          <header><strong>Catálogo permitido</strong><span>{productIds.length} selecionado(s)</span></header>
          <div>{data.products.map(product=><label key={product.id}><input type="checkbox" checked={productIds.includes(product.id)} onChange={e=>setProductIds(current=>e.target.checked?[...current,product.id]:current.filter(id=>id!==product.id))}/><span>{product.name}</span></label>)}</div>
        </section>
        {notice&&<p className="crz-resellers-notice">{notice}</p>}
        <button className="crz-button crz-button--primary crz-button--md" disabled={busy||!userId} onClick={()=>void save()}>{busy?"Salvando...":"Salvar revendedor"}</button>
      </aside>
    </div>
  </div></main>;
}
