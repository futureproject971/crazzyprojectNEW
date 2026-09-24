"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Drawer, Dropdown, LineIcon } from "@/core/design-system";
import { useAuth } from "@/modules/auth/AuthProvider";
import { useCart } from "@/modules/cart/CartProvider";
import { getNavigation } from "./navigation";
import type { ShellMode, ShellNavItem } from "./types";

function ShellIcon({src}:{src:string}){return <span className="crz-shell-icon" aria-hidden="true" style={{WebkitMaskImage:'url("'+src+'")',maskImage:'url("'+src+'")'}}/>}

function NavLinks({items,activeNav,cartCount,compact=false,onNavigate}:{items:ShellNavItem[];activeNav?:string;cartCount:number;compact?:boolean;onNavigate?:()=>void}){
 return <nav className={compact?"crz-shell-mobile-nav":"crz-shell-nav"} aria-label={compact?"Navegação móvel":"Navegação principal"}>
  {items.map(item=>{const active=item.id===activeNav;const badge=item.id==="cart"&&cartCount>0?String(cartCount):item.badge;return <Link key={item.id} href={item.href} className={compact?"crz-shell-mobile-link "+(item.id==="mtsounds"?"is-mtsounds":""):"crz-shell-nav__item "+(item.id==="mtsounds"?"is-mtsounds ":"")+(item.subtitle?"has-subtitle ":"")+(active?"is-active":"")} aria-current={active?"page":undefined} onClick={onNavigate}><ShellIcon src={item.icon}/><span className="crz-shell-nav__copy"><span>{item.label}</span>{item.subtitle&&<small>{item.subtitle}</small>}</span>{badge&&<b>{badge}</b>}</Link>})}
 </nav>
}

export function AppHeader({mode="visitor",activeNav="home",cartCount:fallbackCartCount=0,userName="Meu Painel"}:{mode?:ShellMode;activeNav?:string;cartCount?:number;userName?:string}){
 const [mobileOpen,setMobileOpen]=useState(false);
 const router=useRouter();
 const {totalQuantity,hydrated}=useCart();
 const {user,loading:authLoading,signIn,signOut,discordEnabled}=useAuth();
 const cartCount=hydrated?totalQuantity:fallbackCartCount;
 const effectiveMode:ShellMode=user?(user.role==="admin"?"admin":"client"):(mode==="admin"?"visitor":mode);
 const items=getNavigation(effectiveMode);
 const displayName=user?.username||userName;
 const go=(path:string)=>router.push(path);
 const accountItems=effectiveMode==="admin"?[
  {id:"admin-dashboard",label:"Dashboard",onSelect:()=>go("/admin")},
  {id:"admin-products",label:"Produtos",onSelect:()=>go("/admin/produtos")},
  {id:"admin-bonus",label:"CRAZZY BONUS",onSelect:()=>go("/admin/bonus")},
  {id:"admin-arcade",label:"CRAZZY ARCADE",onSelect:()=>go("/admin/luck")},
  {id:"admin-support",label:"Suporte",onSelect:()=>go("/admin/suporte")},
  {id:"admin-settings",label:"Configurações",onSelect:()=>go("/admin/integracoes")},
  {id:"admin-signout",label:"Sair",danger:true,onSelect:()=>void signOut()},
 ]:[
  {id:"client-dashboard",label:"Painel do Cliente",onSelect:()=>go("/painel")},
  {id:"client-orders",label:"Minhas Compras",onSelect:()=>go("/painel/pedidos")},
  {id:"client-library",label:"Minha Biblioteca",onSelect:()=>go("/biblioteca")},
  {id:"client-bonus",label:"Minha Carteira BONUS",onSelect:()=>go("/bonus")},
  {id:"client-club",label:"CRAZZY CLUB",onSelect:()=>go("/club")},
  {id:"client-coupons",label:"Meus Cupons",onSelect:()=>go("/painel/cupons")},
  {id:"client-profile",label:"Meu Perfil",onSelect:()=>go("/perfil")},
  {id:"client-signout",label:"Sair",danger:true,onSelect:()=>void signOut()},
 ];
 const ticketHref=effectiveMode==="admin"?"/admin/suporte":"/tickets";
 return <>
  <header className="crz-shell-header">
   <div className="crz-shell-header__main"><Link className="crz-shell-brand" href="/" aria-label="CRAZZY PROJECT, início"><img src="/brand/crazzy-logo-hero.png" alt="CRAZZY PROJECT"/></Link><NavLinks items={items} activeNav={activeNav} cartCount={cartCount}/>{effectiveMode!=="visitor"&&<button type="button" className="crz-shell-search" aria-label="Pesquisar"><ShellIcon src="/icons/search.svg"/></button>}</div>
   <div className="crz-shell-header__account" aria-label="Conta e acesso">
    <Link href={ticketHref} className="crz-shell-auth crz-shell-auth--ticket"><ShellIcon src="/icons/headset.svg"/><span>Ticket</span></Link>
    {!user?(discordEnabled?<button type="button" className="crz-shell-auth crz-shell-auth--discord" disabled={authLoading} onClick={()=>void signIn("discord",window.location.pathname)}><img src="/icons/brand-discord.svg" alt="" aria-hidden="true"/><span>{authLoading?"Verificando...":"Entrar com Discord"}</span></button>:<Link href="/login" className="crz-shell-auth"><LineIcon name="user" size={14}/><span>Discord indisponível</span></Link>):<Dropdown items={accountItems} trigger={<span className="crz-shell-user"><span className="crz-shell-user__avatar" aria-hidden="true">{user.avatarUrl?<img src={user.avatarUrl} alt=""/>:null}</span><span>{displayName}</span><LineIcon name="user" size={14}/></span>}/>}
   </div>
   <button type="button" className="crz-shell-menu" aria-label="Abrir menu" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><span/><span/><span/></button>
  </header>
  <Drawer open={mobileOpen} title="CRAZZY PROJECT" onClose={()=>setMobileOpen(false)}><div className="crz-shell-mobile"><img className="crz-shell-mobile__logo" src="/brand/crazzy-logo-hero.png" alt="CRAZZY PROJECT"/><NavLinks items={items} activeNav={activeNav} cartCount={cartCount} compact onNavigate={()=>setMobileOpen(false)}/><div className="crz-shell-mobile__account"><Link className="crz-button crz-button--secondary crz-button--md" href={ticketHref}>Abrir Ticket</Link>{!user?(discordEnabled?<button type="button" className="crz-button crz-button--primary crz-button--md" onClick={()=>void signIn("discord",window.location.pathname)}><img src="/icons/brand-discord.svg" alt="" aria-hidden="true"/> Entrar com Discord</button>:<Link className="crz-button crz-button--primary crz-button--md" href="/login">Discord indisponível</Link>):<><Link className="crz-button crz-button--secondary crz-button--md" href="/painel">{displayName}</Link><button type="button" className="crz-button crz-button--ghost crz-button--md" onClick={()=>void signOut()}>Sair</button></>}</div></div></Drawer>
 </>;
}
