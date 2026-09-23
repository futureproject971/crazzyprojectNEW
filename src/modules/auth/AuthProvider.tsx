"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {createBrowserSupabaseClient} from "@/lib/supabase/client";
import {DISCORD_AUTH_ENABLED} from "@/lib/supabase/config";
import type {AuthMe} from "./types";

type AuthContextValue={
  user:AuthMe|null;
  loading:boolean;
  discordEnabled:boolean;
  googleEnabled:false;
  refresh:()=>Promise<void>;
  signIn:(provider:"discord",next?:string)=>Promise<void>;
  linkDiscord:(next?:string)=>Promise<void>;
  signOut:()=>Promise<void>;
};
const AuthContext=createContext<AuthContextValue|null>(null);
function safeNext(value?:string){if(!value||!value.startsWith("/")||value.startsWith("//"))return"/";return value}

export function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<AuthMe|null>(null);
  const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{
    try{const r=await fetch("/api/auth/me",{cache:"no-store",credentials:"same-origin"});if(!r.ok){setUser(null);return}setUser(await r.json())}
    catch{setUser(null)}finally{setLoading(false)}
  },[]);
  useEffect(()=>{
    const supabase=createBrowserSupabaseClient();void refresh();
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>window.setTimeout(()=>void refresh(),0));
    return()=>subscription.unsubscribe();
  },[refresh]);

  const signIn=useCallback(async(_provider:"discord",next?:string)=>{
    if(!DISCORD_AUTH_ENABLED)throw new Error("Login Discord está desativado.");
    const supabase=createBrowserSupabaseClient();
    const callback=new URL("/auth/callback",window.location.origin);
    callback.searchParams.set("next",safeNext(next));callback.searchParams.set("provider","discord");
    const {error}=await supabase.auth.signInWithOAuth({provider:"discord",options:{redirectTo:callback.toString(),scopes:"identify email guilds"}});
    if(error)throw error;
  },[]);

  const linkDiscord=useCallback(async(next?:string)=>{
    const supabase=createBrowserSupabaseClient();
    const callback=new URL("/auth/callback",window.location.origin);
    callback.searchParams.set("next",safeNext(next||"/perfil"));callback.searchParams.set("provider","discord");
    const {error}=await supabase.auth.linkIdentity({provider:"discord",options:{redirectTo:callback.toString(),scopes:"identify email guilds"}});
    if(error)throw error;
  },[]);

  const signOut=useCallback(async()=>{const supabase=createBrowserSupabaseClient();await supabase.auth.signOut();setUser(null);window.location.assign("/")},[]);
  const value=useMemo<AuthContextValue>(()=>({user,loading,discordEnabled:DISCORD_AUTH_ENABLED,googleEnabled:false,refresh,signIn,linkDiscord,signOut}),[user,loading,refresh,signIn,linkDiscord,signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error("useAuth must be used inside AuthProvider");return context}
