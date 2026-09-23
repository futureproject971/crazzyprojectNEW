"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {Badge,PageHeader} from "@/core/design-system";
type Row=Record<string,any>;

function slugify(value:string){
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}

export function TutorialStudioPage(){
  const [data,setData]=useState<any>({tutorials:[],products:[],plans:[]});
  const [state,setState]=useState<"loading"|"ready"|"error">("loading");
  const [selected,setSelected]=useState<Row|null>(null);
  const [title,setTitle]=useState("");
  const [slug,setSlug]=useState("");
  const [summary,setSummary]=useState("");
  const [category,setCategory]=useState("Geral");
  const [accessType,setAccessType]=useState<"public"|"product"|"plan">("public");
  const [productIds,setProductIds]=useState<string[]>([]);
  const [planIds,setPlanIds]=useState<string[]>([]);
  const [subtitle,setSubtitle]=useState("");
  const [coverUrl,setCoverUrl]=useState("");
  const [sortOrder,setSortOrder]=useState("0");
  const [blocksText,setBlocksText]=useState('[{"type":"title","content":{"text":"Comece aqui"}},{"type":"text","content":{"text":"Explique o passo."}}]');
  const [active,setActive]=useState(true);
  const [featured,setFeatured]=useState(false);
  const [minutes,setMinutes]=useState("5");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    try{
      const r=await fetch("/api/admin/academy",{cache:"no-store"});
      const p=await r.json();
      if(!r.ok)throw new Error();
      setData(p);
      setState("ready");
    }catch{setState("error")}
  },[]);

  useEffect(()=>{void load()},[]);

  const fresh=()=>{
    setSelected(null);setTitle("");setSlug("");setSummary("");setCategory("Geral");setAccessType("public");
    setProductIds([]);setPlanIds([]);setSubtitle("");setCoverUrl("");setSortOrder("0");setActive(true);setFeatured(false);setMinutes("5");
    setBlocksText('[{"type":"title","content":{"text":"Comece aqui"}},{"type":"text","content":{"text":"Explique o passo."}}]');
    setNotice("");
  };

  const choose=(t:Row)=>{
    setSelected(t);setTitle(t.title||"");setSlug(t.slug||"");setSummary(t.summary||"");setCategory(t.category||"Geral");
    setAccessType((t.plan_ids||[]).length?"plan":t.access_type==="product"?"product":"public");setProductIds(t.product_ids||[]);setPlanIds(t.plan_ids||[]);setSubtitle(t.subtitle||"");setCoverUrl(t.cover_url||"");setSortOrder(String(t.sort_order||0));
    setActive(t.active!==false);setFeatured(Boolean(t.featured));setMinutes(String(t.estimated_minutes||5));
    setBlocksText(JSON.stringify((t.blocks||[]).map((b:Row)=>({type:b.block_type,content:b.content})),null,2));
  };

  const save=async()=>{
    let blocks:any[]=[];
    try{const parsed=JSON.parse(blocksText);if(!Array.isArray(parsed))throw new Error();blocks=parsed}catch{return setNotice("Blocks precisa ser um JSON array válido.")}
    const payload={id:selected?.id||null,title,slug:slug||slugify(title),subtitle,coverUrl,summary,category,accessType,productIds:accessType==="product"?productIds:[],planIds:accessType==="plan"?planIds:[],blocks,active,featured,estimatedMinutes:Number(minutes)||5,sortOrder:Number(sortOrder)||0};
    const r=await fetch("/api/admin/academy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const p=await r.json().catch(()=>({}));
    setNotice(r.ok?"Tutorial salvo.":"Falha: "+(p.detail||p.error||"TUTORIAL_SAVE_FAILED"));
    if(r.ok){await load();fresh()}
  };

  const activeCount=useMemo(()=>data.tutorials.filter((t:Row)=>t.active).length,[data]);

  if(state==="loading")return <main className="crz-tutorialstudio-state"><span className="crz-spinner"/></main>;
  if(state==="error")return <main className="crz-tutorialstudio-state">Tutorial Studio indisponível.</main>;

  return <main className="crz-tutorialstudio"><div className="crz-container">
    <PageHeader eyebrow="M45 • TUTORIAL STUDIO" title="Academy editável sem tocar no código" description="Monte tutoriais por blocos, vincule produtos e publique conteúdo público ou exclusivo." actions={<a className="crz-button crz-button--secondary crz-button--sm" href="/academy">Abrir Academy</a>}/>
    <section className="crz-tutorialstudio-stats"><article><small>TUTORIAIS</small><strong>{data.tutorials.length}</strong></article><article><small>ATIVOS</small><strong>{activeCount}</strong></article><article><small>PRODUTOS</small><strong>{data.products.length}</strong></article></section>

    <div className="crz-tutorialstudio-layout">
      <section className="crz-tutorialstudio-list">
        <header><strong>Tutoriais</strong><button onClick={fresh}>+ Novo</button></header>
        {data.tutorials.map((t:Row)=><button key={t.id} className={selected?.id===t.id?"is-selected":""} onClick={()=>choose(t)}>
          <span><strong>{t.title}</strong><small>{t.category} • {t.access_type} • {t.blocks.length} blocos</small></span>
          <Badge tone={t.active?"green":"neutral"}>{t.active?"ATIVO":"OFF"}</Badge>
        </button>)}
      </section>

      <aside className="crz-tutorialstudio-editor">
        <header><div><small>{selected?"EDITAR":"NOVO TUTORIAL"}</small><h2>{title||"Sem título"}</h2></div></header>
        <label><span>Título</span><input value={title} onChange={e=>{setTitle(e.target.value);if(!selected)setSlug(slugify(e.target.value))}}/></label>
        <label><span>Slug</span><input value={slug} onChange={e=>setSlug(e.target.value)}/></label>
        <label><span>Subtítulo</span><input value={subtitle} onChange={e=>setSubtitle(e.target.value)}/></label>
        <label><span>Capa URL</span><input value={coverUrl} onChange={e=>setCoverUrl(e.target.value)}/></label>
        <label><span>Resumo</span><textarea value={summary} onChange={e=>setSummary(e.target.value)}/></label>
        <div className="crz-tutorialstudio-row">
          <label><span>Categoria</span><input value={category} onChange={e=>setCategory(e.target.value)}/></label>
          <label><span>Minutos</span><input type="number" min="1" max="600" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>
          <label><span>Ordem</span><input type="number" value={sortOrder} onChange={e=>setSortOrder(e.target.value)}/></label>
        </div>
        <div className="crz-tutorialstudio-row">
          <label><span>Acesso</span><select value={accessType} onChange={e=>setAccessType(e.target.value==="plan"?"plan":e.target.value==="product"?"product":"public")}><option value="public">Público</option><option value="product">Por produto</option><option value="plan">Por plano específico</option></select></label>
          <label className="is-check"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/><span>Ativo</span></label>
          <label className="is-check"><input type="checkbox" checked={featured} onChange={e=>setFeatured(e.target.checked)}/><span>Destaque</span></label>
        </div>

        {accessType==="product"&&<section className="crz-tutorialstudio-products"><header><strong>Produtos com acesso</strong></header><div>{data.products.map((p:Row)=><label key={p.id}><input type="checkbox" checked={productIds.includes(p.id)} onChange={e=>setProductIds(current=>e.target.checked?[...current,p.id]:current.filter(id=>id!==p.id))}/><span>{p.name}</span></label>)}</div></section>}
        {accessType==="plan"&&<section className="crz-tutorialstudio-products"><header><strong>Planos com acesso</strong></header><div>{data.plans.map((p:Row)=>{const product=data.products.find((x:Row)=>x.id===p.product_id);return <label key={p.id}><input type="checkbox" checked={planIds.includes(p.id)} onChange={e=>setPlanIds(current=>e.target.checked?[...current,p.id]:current.filter(id=>id!==p.id))}/><span>{product?.name||"Produto"} • {p.name}</span></label>})}</div></section>}

        <label><span>Blocks JSON</span><textarea className="is-code" value={blocksText} onChange={e=>setBlocksText(e.target.value)}/></label>
        <p className="crz-tutorialstudio-help">Tipos aceitos: title, subtitle, text, image, video, gallery, checklist, shortcut, code, file, button, info, attention, important, success, separator e step.</p>
        {notice&&<p className="crz-tutorialstudio-notice">{notice}</p>}
        <button className="crz-button crz-button--primary crz-button--md" disabled={!title.trim()} onClick={()=>void save()}>Salvar tutorial</button>
      </aside>
    </div>
  </div></main>;
}
