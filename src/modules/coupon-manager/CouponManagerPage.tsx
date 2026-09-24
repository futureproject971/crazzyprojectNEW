"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";
type Row=Record<string,any>;
function benefit(c:Row){return c.discount_type==="percentage"?Number(c.discount_value)+"%":new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(c.discount_value||0))}
function date(v:string|null){if(!v)return "Sem expiração";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("pt-BR")}

export function CouponManagerPage(){
 const [data,setData]=useState<any>(null),[state,setState]=useState<"loading"|"ready"|"error">("loading"),[selected,setSelected]=useState<Row|null>(null),[query,setQuery]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{try{const r=await fetch("/api/admin/coupons",{cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error();setData(p);setState("ready")}catch{setState("error")}},[]);
 useEffect(()=>{void load()},[]);
 const visible=useMemo(()=>{const q=query.trim().toLowerCase();return(data?.coupons||[]).filter((c:Row)=>!q||c.code.toLowerCase().includes(q)||String(c.origin).includes(q))},[data,query]);
 const save=async(row?:Row,overrides?:{productIds?:string[];userIds?:string[];active?:boolean})=>{
   const code=window.prompt("Código do cupom:",row?.code||"CRZ10");if(!code)return;
   const type=window.prompt("Tipo: percentage ou fixed",row?.discount_type||"percentage")||"";
   const value=Number(window.prompt("Valor do desconto:",String(row?.discount_value||10)));if(!Number.isFinite(value))return;
   const min=Number(window.prompt("Pedido mínimo em R$:",String(row?.min_order_value||0)));if(!Number.isFinite(min))return;
   const maxRaw=window.prompt("Máximo de usos (vazio = ilimitado):",row?.max_uses==null?"":String(row.max_uses));
   const maxUses=maxRaw?Number(maxRaw):null;
   const origin=window.prompt("Origem: promotion, admin, manual...",row?.origin||"admin")||"admin";
   const productIds=overrides?.productIds??row?.product_ids??[];
   const userIds=overrides?.userIds??(row?.users||[]).map((u:Row)=>u.user_id);
   const r=await fetch("/api/admin/coupons",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save_coupon",id:row?.id,code,discountType:type,discountValue:value,minOrderValue:min,maxUses,active:overrides?.active??(row?.active!==false),expiresAt:row?.expires_at,origin,productIds,userIds})});
   const p=await r.json().catch(()=>({}));setNotice(r.ok?"Cupom salvo.":"Falha: "+(p.error||"COUPON_SAVE_FAILED"));if(r.ok)await load();
 };
 if(state==="loading")return <main className="crz-couponmanager-state"><span className="crz-spinner"/><strong>Carregando cupons...</strong></main>;
 if(state==="error"||!data)return <main className="crz-couponmanager-state"><strong>Coupon Manager indisponível.</strong><button onClick={()=>void load()}>Tentar novamente</button></main>;
 const active=data.coupons.filter((c:Row)=>c.active&&(!c.expires_at||new Date(c.expires_at)>new Date())).length;
 return <main className="crz-couponmanager"><div className="crz-container">
   <PageHeader eyebrow="M38 • COUPON MANAGER" title="Cada desconto com origem e limite" description="Promoção, Luck, Reward ou presente administrativo: todos os cupons ficam rastreáveis e validados no checkout." actions={<button className="crz-button crz-button--primary crz-button--sm" type="button" onClick={()=>void save()}>+ Cupom</button>}/>
   <section className="crz-couponmanager-stats"><article><small>TOTAL</small><strong>{data.coupons.length}</strong></article><article><small>ATIVOS</small><strong>{active}</strong></article><article><small>USOS REAIS</small><strong>{data.coupons.reduce((s:number,c:Row)=>s+Number(c.real_uses||0),0)}</strong></article><article><small>RESTRITOS</small><strong>{data.coupons.filter((c:Row)=>c.product_ids.length||c.users.length).length}</strong></article></section>
   <section className="crz-couponmanager-toolbar"><label>⌕ <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Código ou origem..."/></label><a href="/painel/cupons">Carteira do cliente →</a></section>
   {notice&&<p className="crz-couponmanager-notice">{notice}</p>}
   <div className="crz-couponmanager-layout"><section className="crz-couponmanager-list">{visible.map((c:Row)=><button key={c.id} type="button" className={selected?.id===c.id?"is-selected":""} onClick={()=>setSelected(c)}><span><strong>{c.code}</strong><small>{c.origin} • {date(c.expires_at)}</small></span><span><Badge tone={c.active?"green":"neutral"}>{benefit(c)}</Badge><small>{c.real_uses}{c.max_uses?"/"+c.max_uses:""} usos</small></span></button>)}{!visible.length&&<div className="crz-couponmanager-empty">Nenhum cupom.</div>}</section>
   <aside className="crz-couponmanager-detail">{!selected?<div className="crz-couponmanager-empty"><strong>Selecione um cupom</strong></div>:<><header><div><small>{selected.origin.toUpperCase()}</small><h2>{selected.code}</h2><span>{benefit(selected)} • mínimo {selected.min_order_value||0}</span></div><Badge tone={selected.active?"green":"neutral"}>{selected.active?"ATIVO":"OFF"}</Badge></header>
   <div className="crz-couponmanager-grid"><span><small>Usos reais</small><strong>{selected.real_uses}</strong></span><span><small>Máximo</small><strong>{selected.max_uses??"∞"}</strong></span><span><small>Produtos</small><strong>{selected.product_ids.length||"Todos"}</strong></span><span><small>Usuários</small><strong>{selected.users.length||"Público"}</strong></span></div>
   <div className="crz-couponmanager-actions">
     <button className="crz-button crz-button--secondary crz-button--sm" onClick={()=>void save(selected)}>Editar configuração</button>
     <button className="crz-button crz-button--secondary crz-button--sm" onClick={()=>void save(selected,{active:!selected.active})}>{selected.active?"Desativar":"Ativar"}</button>
     <button className="crz-button crz-button--secondary crz-button--sm" onClick={()=>{const raw=window.prompt("UUID do cliente a liberar:");if(!raw||!/^[0-9a-f-]{36}$/i.test(raw))return;void save(selected,{userIds:[...(selected.users||[]).map((u:Row)=>u.user_id),raw]})}}>+ Usuário</button>
   </div>
   <section className="crz-couponmanager-products"><strong>Produtos permitidos</strong><div>{data.products.map((p:Row)=>{const on=selected.product_ids.includes(p.id);return <button key={p.id} className={on?"is-on":""} onClick={()=>void save(selected,{productIds:on?selected.product_ids.filter((id:string)=>id!==p.id):[...selected.product_ids,p.id]})}>{on?"✓ ":""}{p.name}</button>})}</div><small>Nenhum selecionado = válido para todos os produtos.</small></section>
   {selected.users.length>0&&<section><strong>Usuários liberados</strong>{selected.users.slice(0,30).map((u:Row)=><span className="crz-couponmanager-user" key={u.user_id}><a href={"/admin/clientes?userId="+u.user_id}>{u.profile?.username||u.user_id.slice(0,8)}</a><button onClick={()=>void save(selected,{userIds:selected.users.map((x:Row)=>x.user_id).filter((id:string)=>id!==u.user_id)})}>×</button></span>)}</section>}
   </>}</aside></div>
 </div></main>
}
