"use client";
import {useState} from "react";
import {Badge,NeonIcon} from "@/core/design-system";
import {useAuth} from "./AuthProvider";

const errorCopy:Record<string,string>={
  missing_code:"O Discord não devolveu o código de autenticação.",
  oauth_exchange:"A sessão não pôde ser criada. Tente entrar novamente.",
  banned:"Esta conta está bloqueada para acesso à plataforma.",
  discord_only:"A CRAZZY PROJECT usa somente login com Discord.",
  discord_token_missing:"O Discord não devolveu a autorização necessária.",
  discord_sync:"Não foi possível verificar sua conta no Discord. Tente novamente.",
  discord_guild_not_configured:"O servidor oficial ainda não foi configurado no sistema.",
};

export function AuthPage({nextPath="/",initialError=""}:{nextPath?:string;initialError?:string}){
  const {user,loading,signIn,linkDiscord,discordEnabled}=useAuth();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(errorCopy[initialError]||(initialError?"Não foi possível concluir o login.":""));
  const login=async()=>{setBusy(true);setError("");try{await signIn("discord",nextPath)}catch(e){setError(e instanceof Error?e.message:"Não foi possível abrir o Discord.");setBusy(false)}};

  return <main className="crz-auth-page"><div className="crz-auth-backdrop" aria-hidden="true"/>
    <section className="crz-auth-card">
      <a className="crz-auth-brand" href="/"><img src="/brand/crazzy-logo-hero.png" alt="CRAZZY PROJECT"/></a>
      <div className="crz-auth-heading"><Badge tone="blue">CRAZZY AUTH</Badge><h1>{user?"Você já está conectado":"Entrar com Discord"}</h1><p>Uma conta. Um login. Áreas privadas exigem sua conta no servidor oficial da CRAZZY PROJECT.</p></div>
      {loading?<div className="crz-auth-loading"><i/>Verificando sessão...</div>
      :user?<div className="crz-auth-current">
        <div className="crz-auth-avatar">{user.avatarUrl?<img src={user.avatarUrl} alt=""/>:<NeonIcon name="verified" size={30}/>}</div>
        <div><strong>{user.username}</strong><span>{user.email||"Conta conectada"}</span><small>{user.discord.guildMember?"Discord conectado • servidor verificado":"Discord conectado • servidor precisa ser verificado"}</small></div>
        <div className="crz-auth-current__actions">{!user.discord.guildMember&&discordEnabled&&<button type="button" onClick={()=>void linkDiscord(nextPath)}>VERIFICAR DISCORD</button>}{user.discord.guildMember&&<a href={nextPath}>Continuar →</a>}</div>
      </div>
      :<>
        <div className="crz-auth-providers"><button type="button" className="crz-auth-provider crz-auth-provider--discord" disabled={busy||!discordEnabled} onClick={()=>void login()}><img src="/icons/brand-discord.svg" alt=""/><span><strong>{busy?"Abrindo Discord...":discordEnabled?"ENTRAR COM DISCORD":"DISCORD INDISPONÍVEL"}</strong><small>Login oficial + verificação automática do servidor.</small></span><b>→</b></button></div>
        {error&&<div className="crz-auth-error"><NeonIcon name="shield" size={21}/><span>{error}</span></div>}
        <div className="crz-auth-security"><NeonIcon name="shield" size={25}/><div><strong>Discord é a identidade da CRAZZY PROJECT</strong><span>O token do provedor é usado somente no callback para validar identidade e presença no servidor. Ele não é armazenado.</span></div></div>
      </>}
      <footer><a href="/">← Voltar para a loja</a><span>Áreas privadas exigem Discord + servidor oficial.</span></footer>
    </section>
  </main>;
}
