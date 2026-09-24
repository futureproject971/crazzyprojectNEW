"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {Badge,NeonIcon} from "@/core/design-system";

export function DiscordGuildGatePage({nextPath}:{nextPath:string}){
  const router=useRouter();
  const [inviteUrl,setInviteUrl]=useState<string|null>(null);
  const [loadingInvite,setLoadingInvite]=useState(true);
  const [checking,setChecking]=useState(false);
  const [approved,setApproved]=useState(false);
  const [error,setError]=useState("");
  const requestInFlight=useRef(false);
  const inviteOpened=useRef(false);

  const checkMembership=useCallback(async()=>{
    if(requestInFlight.current||approved)return;
    requestInFlight.current=true;
    setChecking(true);
    try{
      const r=await fetch("/api/auth/guild-status",{cache:"no-store",credentials:"same-origin"});
      const p=await r.json().catch(()=>({}));
      if(r.status===401){
        router.replace("/login?next="+encodeURIComponent(nextPath));
        return;
      }
      if(!r.ok){
        setError("Não foi possível verificar sua entrada agora. Vou tentar novamente automaticamente.");
        return;
      }
      setError("");
      if(p?.guildMember===true){
        setApproved(true);
        router.replace(nextPath);
        router.refresh();
      }
    }catch{
      setError("Conexão instável. Continuarei verificando automaticamente.");
    }finally{
      requestInFlight.current=false;
      setChecking(false);
    }
  },[approved,nextPath,router]);

  useEffect(()=>{
    let active=true;
    void fetch("/api/auth/discord-invite",{cache:"no-store"})
      .then(async r=>r.json())
      .then(p=>{
        if(!active)return;
        const url=p?.configured===true&&typeof p?.inviteUrl==="string"?p.inviteUrl:null;
        setInviteUrl(url);
        if(url&&!inviteOpened.current){
          inviteOpened.current=true;
          window.setTimeout(()=>window.open(url,"_blank","noopener,noreferrer"),180);
        }
      })
      .catch(()=>{if(active)setInviteUrl(null)})
      .finally(()=>{if(active)setLoadingInvite(false)});
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    void checkMembership();
    const timer=window.setInterval(()=>void checkMembership(),2000);
    const onVisible=()=>{if(document.visibilityState==="visible")void checkMembership()};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible)};
  },[checkMembership]);

  return <main className="crz-auth-page crz-discord-gate">
    <div className="crz-auth-backdrop" aria-hidden="true"/>
    <section className="crz-auth-card crz-discord-gate__card">
      <a className="crz-auth-brand" href="/"><img src="/brand/crazzy-logo-hero.png" alt="CRAZZY PROJECT"/></a>
      <div className="crz-auth-heading">
        <Badge tone={approved?"green":"blue"}>{approved?"ACESSO LIBERADO":"DISCORD REQUIRED"}</Badge>
        <h1>{approved?"Entrada confirmada.":"Falta só entrar no servidor."}</h1>
        <p>{approved?"O bot confirmou sua entrada. Abrindo a CRAZZY PROJECT...":"Seu Discord já foi autenticado. Agora entre no servidor oficial e deixe esta página aberta."}</p>
      </div>

      {!approved&&<div className="crz-discord-gate__steps">
        <article><b>1</b><span><strong>Discord abre para você</strong><small>O convite oficial é aberto automaticamente. Se o navegador bloquear, use o botão abaixo.</small></span></article>
        <article><b>2</b><span><strong>Entre no servidor</strong><small>Não precisa repetir o login nem fechar esta tela.</small></span></article>
        <article><b>3</b><span><strong>Aprovação automática</strong><small>O Bot Core confirma sua entrada e o site libera sozinho.</small></span></article>
      </div>}

      <div className="crz-discord-gate__actions">
        {approved?<button className="crz-button crz-button--primary crz-button--md" disabled><NeonIcon name="verified" size={18}/>Acesso confirmado</button>
        :loadingInvite?<button className="crz-button crz-button--secondary crz-button--md" disabled>Carregando convite...</button>
        :inviteUrl?<a className="crz-button crz-button--primary crz-button--md" href={inviteUrl} target="_blank" rel="noreferrer"><img src="/icons/brand-discord.svg" alt=""/>Abrir Discord / entrar no servidor</a>
        :<div className="crz-discord-gate__missing">Convite do servidor ainda não configurado pelo administrador.</div>}

        {!approved&&<button type="button" className="crz-button crz-button--secondary crz-button--md" disabled={checking} onClick={()=>void checkMembership()}><NeonIcon name="verified" size={18}/>{checking?"Verificando entrada...":"Verificar agora"}</button>}
      </div>

      {!approved&&<div className="crz-auth-loading"><i/>{checking?"Consultando o Bot Core...":"Aguardando você entrar no Discord • verificação automática a cada 2s"}</div>}
      {error&&!approved&&<div className="crz-auth-error"><NeonIcon name="shield" size={20}/><span>{error}</span></div>}
      <div className="crz-auth-security"><NeonIcon name="shield" size={25}/><div><strong>{approved?"Servidor confirmado":"Sessão autenticada, acesso privado bloqueado"}</strong><span>{approved?"Seu Discord está confirmado na guild oficial.":"Enquanto você estiver fora da guild, middleware e APIs privadas continuam bloqueados. Entrou no servidor, o acesso é liberado automaticamente."}</span></div></div>
    </section>
  </main>;
}
