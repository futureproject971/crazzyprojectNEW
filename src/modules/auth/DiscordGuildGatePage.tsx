"use client";
import {useEffect,useState} from "react";
import {Badge,NeonIcon} from "@/core/design-system";
import {useAuth} from "./AuthProvider";

export function DiscordGuildGatePage({nextPath}:{nextPath:string}){
  const {signIn}=useAuth();
  const [inviteUrl,setInviteUrl]=useState<string|null>(null);
  const [loadingInvite,setLoadingInvite]=useState(true);
  const [checking,setChecking]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    void fetch("/api/auth/discord-invite",{cache:"no-store"})
      .then(async r=>r.json())
      .then(p=>{if(active)setInviteUrl(p?.configured===true&&typeof p?.inviteUrl==="string"?p.inviteUrl:null)})
      .catch(()=>{if(active)setInviteUrl(null)})
      .finally(()=>{if(active)setLoadingInvite(false)});
    return()=>{active=false};
  },[]);

  const verify=async()=>{
    if(checking)return;
    setChecking(true);setError("");
    try{await signIn("discord",nextPath)}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível verificar novamente.");setChecking(false)}
  };

  return <main className="crz-auth-page crz-discord-gate">
    <div className="crz-auth-backdrop" aria-hidden="true"/>
    <section className="crz-auth-card crz-discord-gate__card">
      <a className="crz-auth-brand" href="/"><img src="/brand/crazzy-logo-hero.png" alt="CRAZZY PROJECT"/></a>
      <div className="crz-auth-heading">
        <Badge tone="blue">DISCORD REQUIRED</Badge>
        <h1>Falta só entrar no servidor.</h1>
        <p>Seu Discord foi reconhecido, mas ele ainda não apareceu como membro do servidor oficial da CRAZZY PROJECT.</p>
      </div>
      <div className="crz-discord-gate__steps">
        <article><b>1</b><span><strong>Entre no servidor oficial</strong><small>Use o convite da CRAZZY PROJECT.</small></span></article>
        <article><b>2</b><span><strong>Volte para esta tela</strong><small>Não precisa criar outra conta.</small></span></article>
        <article><b>3</b><span><strong>Verifique novamente</strong><small>Se a guild aparecer, o acesso privado é liberado.</small></span></article>
      </div>
      <div className="crz-discord-gate__actions">
        {loadingInvite?<button className="crz-button crz-button--secondary crz-button--md" disabled>Carregando convite...</button>
        :inviteUrl?<a className="crz-button crz-button--primary crz-button--md" href={inviteUrl} target="_blank" rel="noreferrer"><img src="/icons/brand-discord.svg" alt=""/>Entrar no servidor</a>
        :<div className="crz-discord-gate__missing">Convite do servidor ainda não configurado pelo administrador.</div>}
        <button type="button" className="crz-button crz-button--secondary crz-button--md" disabled={checking} onClick={()=>void verify()}><NeonIcon name="verified" size={18}/>{checking?"Abrindo Discord...":"Já entrei, verificar novamente"}</button>
      </div>
      {error&&<div className="crz-auth-error">{error}</div>}
      <div className="crz-auth-security"><NeonIcon name="shield" size={25}/><div><strong>Sessão bloqueada enquanto estiver fora da guild</strong><span>Áreas privadas só recebem uma sessão válida depois que o Discord confirmar sua entrada.</span></div></div>
    </section>
  </main>;
}
