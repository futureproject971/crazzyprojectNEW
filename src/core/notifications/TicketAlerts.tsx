"use client";
import {useEffect,useRef,useState} from "react";
import {usePathname} from "next/navigation";
import {useAuth} from "@/modules/auth/AuthProvider";
type Notice={id:string;notification_type:string;title:string;body:string;href:string|null;read_at:string|null;created_at:string};
export function TicketAlerts(){
 const {user}=useAuth(),pathname=usePathname();
 const [items,setItems]=useState<Notice[]>([]),[enabled,setEnabled]=useState(false),[message,setMessage]=useState("");
 const seen=useRef(new Set<string>()),initialized=useRef(false),audio=useRef<AudioContext|null>(null);
 useEffect(()=>{setEnabled(localStorage.getItem("crz:ticket-alerts")==="on")},[]);
 useEffect(()=>{
  seen.current.clear();initialized.current=false;setItems([]);
  if(!user)return;
  let stopped=false;
  const refresh=async()=>{
   try{
    const response=await fetch("/api/notifications",{cache:"no-store"});if(!response.ok)return;
    const payload=await response.json();if(stopped)return;
    const notices=(payload.notifications||[]).filter((n:Notice)=>n.notification_type==="support") as Notice[];
    const onPage=notices.filter(n=>!n.read_at&&n.href===pathname);
    if(onPage.length)await fetch("/api/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:onPage.map(n=>n.id)})});
    setItems(notices.filter(n=>!n.read_at&&n.href!==pathname));
    for(const n of notices){
     if(initialized.current&&!seen.current.has(n.id)&&!n.read_at&&n.href!==pathname&&enabled){
      if(audio.current?.state==="running"){const oscillator=audio.current.createOscillator(),gain=audio.current.createGain();oscillator.connect(gain);gain.connect(audio.current.destination);oscillator.frequency.value=660;gain.gain.setValueAtTime(.08,audio.current.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.current.currentTime+.2);oscillator.start();oscillator.stop(audio.current.currentTime+.2);}
      if("Notification" in window&&Notification.permission==="granted"){
       const options={body:"A equipe respondeu seu ticket. Abra para acompanhar.",tag:n.id,icon:"/brand/crazzy-logo-navbar.png",data:{url:n.href||"/tickets"}};
       const registration="serviceWorker" in navigator?await navigator.serviceWorker.getRegistration():null;
       if(registration)await registration.showNotification(n.title,options);
       else new Notification(n.title,options);
      }
     }
     seen.current.add(n.id);
    }
    initialized.current=true;
   }catch{/* Keep prior alerts during transient failures. */}
  };
  void refresh();const timer=setInterval(()=>void refresh(),20000);
  return()=>{stopped=true;clearInterval(timer)};
 },[user?.id,pathname,enabled]);
 const toggle=async()=>{
  if(enabled){localStorage.removeItem("crz:ticket-alerts");setEnabled(false);return;}
  try{audio.current=new AudioContext();await audio.current.resume();}catch{}
  if("Notification" in window){const permission=await Notification.requestPermission();setMessage(permission==="granted"?"Avisos ativados enquanto o site estiver aberto.":"Avisos no site ativados. O navegador não liberou notificações do sistema.");}
  else setMessage("Este navegador permite os avisos dentro do site.");
  localStorage.setItem("crz:ticket-alerts","on");setEnabled(true);
 };
 if(!user)return null;
 const isTickets=pathname.startsWith("/tickets")||pathname.startsWith("/admin/suporte");
 return <>{items.length>0&&<aside className="crz-ticket-alert" role="status"><a href={items[0].href||"/tickets"}><strong>A equipe respondeu você</strong><span>{items.length} {items.length===1?"aviso de suporte":"avisos de suporte"} · Abrir ticket →</span></a></aside>}{isTickets&&<div className="crz-ticket-notification-settings"><button onClick={()=>void toggle()}>{enabled?"Desativar avisos e som":"Ativar avisos e som"}</button>{message&&<small role="status">{message}</small>}</div>}</>;
}
