"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Drawer, Dropdown, LineIcon } from "@/core/design-system";
import { useAuth } from "@/modules/auth/AuthProvider";
import { useCart } from "@/modules/cart/CartProvider";
import { useTheme } from "@/core/theme/ThemeProvider";
import { getNavigation } from "./navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { AdminNavigation } from "./AdminNavigation";
import type { ShellMode, ShellNavItem } from "./types";

function ShellIcon({src}:{src:string}){return <span className="crz-shell-icon" aria-hidden="true" style={{WebkitMaskImage:'url("'+src+'")',maskImage:'url("'+src+'")'}}/>}

const secondaryIds = new Set(["accounts", "combo", "community", "mtsounds"]);
function NavLinks({items,activeNav,cartCount,compact=false,onNavigate}:{items:ShellNavItem[];activeNav?:string;cartCount:number;compact?:boolean;onNavigate?:()=>void}){
 const overflow = useRef<HTMLDetailsElement>(null);
 useEffect(() => {
  const close = (event: PointerEvent) => { if (overflow.current && !overflow.current.contains(event.target as Node)) overflow.current.open = false; };
  const escape = (event: KeyboardEvent) => { if(event.key === "Escape" && overflow.current?.open){overflow.current.open=false;overflow.current.querySelector("summary")?.focus();} };
  document.addEventListener("pointerdown",close);document.addEventListener("keydown",escape);
  return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape);};
 },[]);
 const render=(item:ShellNavItem,inMenu=false)=>{
  const badge=item.id==="cart"&&cartCount>0?String(cartCount):item.badge;
  return <Link key={item.id} href={item.href} className={(compact||inMenu?"crz-shell-mobile-link ":"crz-shell-nav__item ")+"is-"+item.id+(item.id===activeNav?" is-active":"")} aria-current={item.id===activeNav?"page":undefined} onClick={()=>{if(overflow.current)overflow.current.open=false;onNavigate?.();}}><ShellIcon src={item.icon}/><span className="crz-shell-nav__copy"><span>{item.label}</span></span>{badge&&<b>{badge}</b>}</Link>;
 };
 return <nav className={compact?"crz-shell-mobile-nav":"crz-shell-nav"} aria-label={compact?"Navegação móvel":"Navegação principal"}>
  {items.filter(item=>compact||(!secondaryIds.has(item.id)&&item.id!=="cart")).map(item=>render(item))}
  {!compact&&<details ref={overflow} className="crz-shell-overflow"><summary className={secondaryIds.has(activeNav||"")?"is-active":""}>Mais <span aria-hidden="true">⌄</span></summary><div className="crz-shell-overflow__links">{items.filter(item=>secondaryIds.has(item.id)).map(item=>render(item,true))}</div></details>}
 </nav>;
}

export function AppHeader({mode="visitor",activeNav="home",cartCount:fallbackCartCount=0,userName="Meu Painel"}:{mode?:ShellMode;activeNav?:string;cartCount?:number;userName?:string}){
 const [mobileOpen,setMobileOpen]=useState(false);
 const [openTicketCount,setOpenTicketCount]=useState(0);
 const router=useRouter();
 const {totalQuantity,hydrated}=useCart();
 const {user,loading:authLoading,signIn,signOut,discordEnabled}=useAuth();
 const {brandName,logoNavbarUrl}=useTheme();
 const cartCount=hydrated?totalQuantity:fallbackCartCount;
 const effectiveMode:ShellMode=user?(user.role==="admin"?"admin":"client"):(mode==="admin"?"visitor":mode);
 const refreshOpenTicketCount=useCallback(async()=>{
  if(effectiveMode!=="admin"){
   setOpenTicketCount(0);
   return;
  }
  try{
   const response=await fetch("/api/admin/support/open-count",{cache:"no-store",credentials:"same-origin"});
   const payload=await response.json().catch(()=>({}));
   if(response.ok)setOpenTicketCount(Math.max(0,Number(payload?.openCount||0)));
  }catch{
   // Badge is non-blocking: keep the last known number on transient failures.
  }
 },[effectiveMode]);

 useEffect(()=>{
  if(effectiveMode!=="admin"){
   setOpenTicketCount(0);
   return;
  }

  void refreshOpenTicketCount();
  const supabase=createBrowserSupabaseClient();
  let timer:number|null=null;

  const queueRefresh=()=>{
   if(timer)window.clearTimeout(timer);
   timer=window.setTimeout(()=>{
    timer=null;
    void refreshOpenTicketCount();
   },120);
  };

  const channel=supabase
   .channel("admin-open-ticket-badge")
   .on(
    "postgres_changes",
    {event:"*",schema:"public",table:"support_tickets"},
    queueRefresh
   )
   .subscribe();

  const fallback=window.setInterval(()=>{
   if(document.visibilityState==="visible")void refreshOpenTicketCount();
  },30000);

  return()=>{
   if(timer)window.clearTimeout(timer);
   window.clearInterval(fallback);
   void supabase.removeChannel(channel);
  };
 },[effectiveMode,refreshOpenTicketCount]);
 const items=getNavigation(effectiveMode);
 const displayName=user?.username||userName;
 const go=(path:string)=>router.push(path);
 const accountItems=effectiveMode==="admin"?[
  {id:"admin-dashboard",label:"Dashboard",onSelect:()=>go("/painel")},
  {id:"admin-panel",label:"Painel Admin",tone:"admin" as const,onSelect:()=>go("/admin")},
  {id:"admin-orders",label:"Minhas Compras",onSelect:()=>go("/painel/pedidos")},
  {id:"admin-library",label:"Minha Biblioteca",onSelect:()=>go("/biblioteca")},
  {id:"admin-bonus",label:"Minha Carteira BONUS",onSelect:()=>go("/bonus")},
  {id:"admin-profile",label:"Meu Perfil",onSelect:()=>go("/perfil")},
  {id:"admin-support",label:"Meus Tickets",onSelect:()=>go("/tickets")},
  {id:"admin-settings",label:"Configurações",onSelect:()=>go("/admin/integracoes")},
  {id:"admin-signout",label:"Sair",danger:true,onSelect:()=>void signOut()},
 ]:[
  {id:"client-dashboard",label:"Dashboard",onSelect:()=>go("/painel")},
  {id:"client-orders",label:"Minhas Compras",onSelect:()=>go("/painel/pedidos")},
  {id:"client-library",label:"Minha Biblioteca",onSelect:()=>go("/biblioteca")},
  {id:"client-bonus",label:"Minha Carteira BONUS",onSelect:()=>go("/bonus")},
  {id:"client-club",label:"CRAZZY CLUB",onSelect:()=>go("/club")},
  {id:"client-coupons",label:"Meus Cupons",onSelect:()=>go("/painel/cupons")},
  {id:"client-profile",label:"Meu Perfil",onSelect:()=>go("/perfil")},
  {id:"client-signout",label:"Sair",danger:true,onSelect:()=>void signOut()},
 ];
 const ticketHref="/tickets";
 return <>
  <header className="crz-shell-header">
   <div className="crz-shell-header__main"><Link className="crz-shell-brand" href="/" aria-label={brandName+", início"}><img src={logoNavbarUrl} alt={brandName}/></Link><NavLinks items={items} activeNav={activeNav} cartCount={cartCount}/><div className="crz-shell-header__actions"><Link className="crz-shell-cart" href="/carrinho" aria-label={"Carrinho, " + cartCount + " itens"}><ShellIcon src="/icons/shopping-cart.svg"/>{cartCount>0&&<b>{cartCount>99?"99+":cartCount}</b>}</Link>{effectiveMode!=="visitor"&&<button type="button" className="crz-shell-search" aria-label="Pesquisar produtos" onClick={()=>go("/produtos")}><ShellIcon src="/icons/search.svg"/></button>}</div></div>
   <div className="crz-shell-header__account" aria-label="Conta e acesso">
    <Link href={ticketHref} className="crz-shell-auth crz-shell-auth--ticket" aria-label="Abrir ticket de suporte" title="Abrir ticket de suporte"><ShellIcon src="/icons/headset.svg"/><span className="crz-shell-auth__label">Tickets</span>{effectiveMode==="admin"&&openTicketCount>0&&<b className="crz-ticket-pending" title="Tickets aguardando resposta da equipe">{openTicketCount>99?"99+":openTicketCount}</b>}</Link>
    {!user?(discordEnabled?<button type="button" className="crz-shell-auth crz-shell-auth--discord" disabled={authLoading} onClick={()=>void signIn("discord",window.location.pathname)}><img src="/icons/brand-discord.svg" alt="" aria-hidden="true"/><span>{authLoading?"Verificando...":"Entrar com Discord"}</span></button>:<Link href="/login" className="crz-shell-auth"><LineIcon name="user" size={14}/><span>Discord indisponível</span></Link>):<Dropdown items={accountItems} trigger={<span className="crz-shell-user"><span className="crz-shell-user__avatar" aria-hidden="true">{user.avatarUrl?<img src={user.avatarUrl} alt=""/>:null}</span><span>{displayName}</span><LineIcon name="user" size={14}/></span>}/>}
   </div>
   <button type="button" className="crz-shell-menu" aria-label="Abrir menu" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><span/><span/><span/></button>
  </header>
  {mode==="admin"&&effectiveMode==="admin"&&<AdminNavigation/>}
  <Drawer open={mobileOpen} title="CRAZZY PROJECT" onClose={()=>setMobileOpen(false)}><div className="crz-shell-mobile"><img className="crz-shell-mobile__logo" src={logoNavbarUrl} alt={brandName}/><NavLinks items={items} activeNav={activeNav} cartCount={cartCount} compact onNavigate={()=>setMobileOpen(false)}/><div className="crz-shell-mobile__account"><Link className="crz-button crz-button--secondary crz-button--md" href={ticketHref}>Abrir Ticket</Link>{!user?(discordEnabled?<button type="button" className="crz-button crz-button--primary crz-button--md" onClick={()=>void signIn("discord",window.location.pathname)}><img src="/icons/brand-discord.svg" alt="" aria-hidden="true"/> Entrar com Discord</button>:<Link className="crz-button crz-button--primary crz-button--md" href="/login">Discord indisponível</Link>):<><Link className="crz-button crz-button--secondary crz-button--md" href="/painel">{displayName}</Link>{effectiveMode==="admin"&&<Link className="crz-button crz-button--danger crz-button--md" href="/admin" onClick={()=>setMobileOpen(false)}>Painel Admin</Link>}<button type="button" className="crz-button crz-button--ghost crz-button--md" onClick={()=>void signOut()}>Sair</button></>}</div></div></Drawer>
 </>;
}
