"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function InternalNavigationBridge(){
 const router=useRouter();
 useEffect(()=>{
  const handle=(event:MouseEvent)=>{
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const target=event.target instanceof Element?event.target:null;
   const anchor=target?.closest("a[href]") as HTMLAnchorElement|null;
   if(!anchor||anchor.hasAttribute("download")||anchor.dataset.nativeNavigation==="true")return;
   if(anchor.target&&anchor.target!=="_self")return;
   const url=new URL(anchor.href,window.location.href);
   if(url.origin!==window.location.origin)return;
   if(url.pathname===window.location.pathname&&url.search===window.location.search&&url.hash)return;
   event.preventDefault();
   router.push(url.pathname+url.search+url.hash);
  };
  document.addEventListener("click",handle);
  return()=>document.removeEventListener("click",handle);
 },[router]);
 return null;
}
