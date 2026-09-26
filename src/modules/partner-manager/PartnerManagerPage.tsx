"use client";
import {useCallback,useEffect,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";
import {adminConfirm,adminPrompt} from "@/core/ui/adminDialog";
type Row=Record<string,any>;
const money=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(c)||0)/100);

export function PartnerManagerPage(){
  const [data,setData]=useState<any>({partners:[],rules:[],plans:[],totals:{},candidates:[]});
  const [state,setState]=useState<"loading"|"ready"|"error">("loading");
  const [selected,setSelected]=useState<Row|null>(null);
  const [candidate,setCandidate]=useState<Row|null>(null);
  const [q,setQ]=useState("");
  const [notice,setNotice]=useState("");
  const [form,setForm]=useState({code:"mtsounds",displayName:"MTSOUNDS",commissionPercent:"15",attributionDays:"30",holdDays:"7",active:true,notes:""});

  const load=useCallback(async(search="")=>{
    try{
      const r=await fetch("/api/admin/partners"+(search?"?q="+encodeURIComponent(search):""),{cache:"no-store"});
      const p=await r.json();if(!r.ok)throw new Error();
      setData(p);setState("ready");
    }catch{setState("error")}
  },[]);
  useEffect(()=>{void load()},[]);

  const choose=(p:Row)=>{setSelected(p);setCandidate(null);setForm({code:p.code||"",displayName:p.display_name||"",commissionPercent:String(p.commission_percent??15),attributionDays:String(p.attribution_days??30),holdDays:String(p.commission_hold_days??7),active:p.active!==false,notes:p.notes||""})};
  const newFrom=(c:Row)=>{setSelected(null);setCandidate(c);setForm({code:"mtsounds",displayName:c.discord_global_name||c.username||c.discord_username||"MTSOUNDS",commissionPercent:"15",attributionDays:"30",holdDays:"7",active:true,notes:""})};

  const save=async()=>{
    const userId=selected?.user_id||candidate?.user_id;if(!userId)return setNotice("Escolha um perfil primeiro.");
    const r=await fetch("/api/admin/partners",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save_partner",id:selected?.id||null,userId,...form,commissionPercent:Number(form.commissionPercent),attributionDays:Number(form.attributionDays),holdDays:Number(form.holdDays)})});
    const p=await r.json().catch(()=>({}));setNotice(r.ok?"Parceiro salvo.":"Falha: "+(p.detail||p.error||"erro"));
    if(r.ok){setCandidate(null);setSelected(null);await load()}
  };

  const ruleFor=(planId:string)=>data.rules.find((r:Row)=>r.partner_id===selected?.id&&r.product_plan_id===planId);
  const toggleRule=async(plan:Row)=>{
    if(!selected)return;
    const current=ruleFor(plan.id);const enabled=!(current?.enabled===true);
    const r=await fetch("/api/admin/partners",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"set_rule",partnerId:selected.id,planId:plan.id,enabled,commissionPercent:null})});
    const p=await r.json().catch(()=>({}));setNotice(r.ok?"Regra atualizada.":"Falha: "+(p.detail||p.error||"erro"));if(r.ok)await load();
  };

  const totalAvailable=Number(data.totals?.available_cents||0);
  const link=selected?"/mtsounds?via="+selected.code:null;
  const payAvailable=async()=>{
    if(!selected)return;
    const available=Number(selected.totals?.available_cents||0);
    if(available<=0)return setNotice("Este parceiro não tem saldo disponível.");
    const reference=(await adminPrompt("Registrar pagamento",{label:"Referência do pagamento (Pix, banco ou observação)",defaultValue:""}))||"";
    if(!(await adminConfirm("Confirmar pagamento","Pagar "+money(available)+" para "+selected.display_name+"?","Confirmar pagamento")))return;
    const r=await fetch("/api/admin/partners",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"payout_available",partnerId:selected.id,reference})});
    const p=await r.json().catch(()=>({}));
    setNotice(r.ok?"Payout registrado: "+money(Number(p.amount_cents||0)):"Falha: "+(p.detail||p.error||"erro"));
    if(r.ok){setSelected(null);await load();}
  };

  if(state==="loading")return <main className="crz-partner-state"><span className="crz-spinner"/></main>;
  if(state==="error")return <main className="crz-partner-state">Partner Manager indisponível.</main>;

  return <main className="crz-partner"><div className="crz-container">
    <PageHeader eyebrow="PARTNER MANAGER" title="Parcerias e comissão por origem" description="Vincule um perfil Discord, defina a porcentagem e escolha exatamente quais planos automáticos geram comissão."/>
    <section className="crz-partner-stats"><article><small>PARCEIROS</small><strong>{data.totals?.partners||0}</strong></article><article><small>ATIVOS</small><strong>{data.totals?.active_partners||0}</strong></article><article><small>DISPONÍVEL</small><strong>{money(totalAvailable)}</strong></article></section>

    <div className="crz-partner-layout">
      <section className="crz-partner-list">
        <header><strong>Parceiros</strong></header>
        {(data.partners||[]).map((p:Row)=><button key={p.id} className={selected?.id===p.id?"is-active":""} onClick={()=>choose(p)}><span><strong>{p.display_name}</strong><small>{p.code} • {p.commission_percent}% • {p.profile?.discord_global_name||p.profile?.username||"Perfil conectado"}</small></span><Badge tone={p.active?"green":"neutral"}>{p.active?"ATIVO":"OFF"}</Badge></button>)}
        {!data.partners?.length&&<div className="crz-partner-empty">Nenhum parceiro cadastrado.</div>}
      </section>

      <section className="crz-partner-editor">
        <header><strong>{selected?"Editar parceiro":"Novo parceiro"}</strong>{selected&&<small>{link}</small>}</header>
        {!selected&&!candidate&&<div className="crz-partner-search"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nome ou usuário do Discord"/><button onClick={()=>void load(q)}>Buscar perfil</button>{(data.candidates||[]).map((c:Row)=><button className="is-candidate" key={c.user_id} onClick={()=>newFrom(c)}><strong>{c.discord_global_name||c.username||c.discord_username||"Perfil Discord"}</strong><small>{c.guild_member?"No servidor CRAZZY":"Fora do servidor"}</small></button>)}</div>}
        {(selected||candidate)&&<>
          <div className="crz-partner-grid">
            <label><span>Código/link</span><input value={form.code} onChange={e=>setForm({...form,code:e.target.value.toLowerCase()})}/></label>
            <label><span>Nome</span><input value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/></label>
            <label><span>Comissão %</span><input type="number" min="0" max="50" step=".1" value={form.commissionPercent} onChange={e=>setForm({...form,commissionPercent:e.target.value})}/></label>
            <label><span>Atribuição (dias)</span><input type="number" min="1" max="90" value={form.attributionDays} onChange={e=>setForm({...form,attributionDays:e.target.value})}/></label>
            <label><span>Hold (dias)</span><input type="number" min="0" max="90" value={form.holdDays} onChange={e=>setForm({...form,holdDays:e.target.value})}/></label>
            <label className="is-check"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/><span>Ativo</span></label>
          </div>
          <label className="crz-partner-notes"><span>Notas internas</span><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
          <button className="crz-button crz-button--primary crz-button--sm" onClick={()=>void save()}>Salvar parceiro</button>
        </>}

        {selected&&<section className="crz-partner-payout"><header><strong>Financeiro do parceiro</strong><small>Disponível agora: {money(Number(selected.totals?.available_cents||0))}</small></header><button className="crz-button crz-button--primary crz-button--sm" disabled={Number(selected.totals?.available_cents||0)<=0} onClick={()=>void payAvailable()}>Pagar saldo disponível</button></section>}
        {selected&&<section className="crz-partner-rules"><header><strong>Planos que geram comissão</strong><small>Somente entrega automática pode ser ativada.</small></header>{data.plans.map((plan:Row)=>{const rule=ruleFor(plan.id);return <button key={plan.id} disabled={!plan.commission_eligible} className={rule?.enabled?"is-on":""} onClick={()=>void toggleRule(plan)}><span><strong>{plan.product_name} • {plan.name}</strong><small>{plan.delivery_mode} • R$ {Number(plan.price).toFixed(2)}</small></span><Badge tone={!plan.commission_eligible?"neutral":rule?.enabled?"green":"blue"}>{!plan.commission_eligible?"NÃO ELEGÍVEL":rule?.enabled?String(Number(rule?.commission_percent??selected.commission_percent??0))+"% ON":"OFF"}</Badge></button>})}</section>}
        {notice&&<p className="crz-partner-notice">{notice}</p>}
      </section>
    </div>
  </div></main>;
}
