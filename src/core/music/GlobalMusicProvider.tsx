"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type GlobalTrackSource = "youtube" | "youtube-music";

export type GlobalTrack = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  source?: GlobalTrackSource;
};

type PlayerContextValue = {
  current: GlobalTrack | null;
  queue: GlobalTrack[];
  playlist: GlobalTrack[];
  playing: boolean;
  expanded: boolean;
  playNow: (track: GlobalTrack) => void;
  enqueue: (track: GlobalTrack) => void;
  previous: () => void;
  next: () => void;
  toggle: () => void;
  stop: () => void;
  toggleExpanded: () => void;
  addToPlaylist: (track: GlobalTrack) => void;
  removeFromPlaylist: (id: string) => void;
  playPlaylist: () => void;
  clearQueue: () => void;
};

const PlayerContext=createContext<PlayerContextValue|null>(null);
const QUEUE_KEY="crz:mtsounds:queue:v1";
const PLAYLIST_KEY="crz:mtsounds:playlist:v1";
const INDEX_KEY="crz:mtsounds:index:v1";

function safeParse<T>(raw:string|null,fallback:T):T{
  if(!raw)return fallback;
  try{return JSON.parse(raw) as T;}catch{return fallback;}
}

function dedupe(items:GlobalTrack[]){
  const seen=new Set<string>();
  return items.filter(item=>{
    const key=item.id+"::"+(item.source||"youtube");
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}

export function useGlobalMusic(){
  const value=useContext(PlayerContext);
  if(!value)throw new Error("useGlobalMusic must be used inside GlobalMusicProvider");
  return value;
}

export function GlobalMusicProvider({children}:{children:ReactNode}){
  const iframeRef=useRef<HTMLIFrameElement>(null);
  const [hydrated,setHydrated]=useState(false);
  const [queue,setQueue]=useState<GlobalTrack[]>([]);
  const [playlist,setPlaylist]=useState<GlobalTrack[]>([]);
  const [index,setIndex]=useState(-1);
  const [playing,setPlaying]=useState(false);
  const [expanded,setExpanded]=useState(false);

  useEffect(()=>{
    const savedQueue=safeParse<GlobalTrack[]>(localStorage.getItem(QUEUE_KEY),[]);
    const savedPlaylist=safeParse<GlobalTrack[]>(localStorage.getItem(PLAYLIST_KEY),[]);
    const savedIndex=Number(localStorage.getItem(INDEX_KEY)??"-1");
    setQueue(dedupe(savedQueue));
    setPlaylist(dedupe(savedPlaylist));
    setIndex(Number.isFinite(savedIndex)&&savedIndex>=0&&savedIndex<savedQueue.length?savedIndex:-1);
    setHydrated(true);
  },[]);

  useEffect(()=>{
    if(!hydrated)return;
    localStorage.setItem(QUEUE_KEY,JSON.stringify(queue));
    localStorage.setItem(PLAYLIST_KEY,JSON.stringify(playlist));
    localStorage.setItem(INDEX_KEY,String(index));
  },[queue,playlist,index,hydrated]);

  const current=index>=0&&index<queue.length?queue[index]:null;

  useEffect(()=>{
    window.dispatchEvent(new CustomEvent("mtsounds:playback",{detail:{playing}}));
    if(!playing)window.dispatchEvent(new CustomEvent("mtsounds:audiolevel",{detail:{bass:0,level:0}}));
  },[playing]);

  const postCommand=useCallback((func:string,args:unknown[]=[])=>( 
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({event:"command",func,args}),"*")
  ),[]);

  useEffect(()=>{
    if(!current)return;
    postCommand(playing?"playVideo":"pauseVideo");
  },[current?.id,playing,postCommand]);

  const previous=useCallback(()=>{
    if(!queue.length)return;
    if(index<=0){
      setIndex(0);
      postCommand("seekTo",[0,true]);
      setPlaying(true);
      return;
    }
    setIndex(index-1);
    setPlaying(true);
  },[queue.length,index,postCommand]);

  const next=useCallback(()=>{
    if(!queue.length)return;
    if(index<0){
      setIndex(0);
      setPlaying(true);
      return;
    }
    if(index>=queue.length-1){
      setPlaying(false);
      return;
    }
    setIndex(index+1);
    setPlaying(true);
  },[queue.length,index]);

  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(!event.origin.includes("youtube.com")&&!event.origin.includes("youtube-nocookie.com"))return;
      try{
        const data=typeof event.data==="string"?JSON.parse(event.data):event.data;
        if(data?.event!=="onStateChange")return;
        if(data.info===1)setPlaying(true);
        if(data.info===2)setPlaying(false);
        if(data.info===0)next();
      }catch{}
    };
    window.addEventListener("message",receive);
    return()=>window.removeEventListener("message",receive);
  },[next]);

  const playNow=useCallback((track:GlobalTrack)=>{
    setQueue(prev=>{
      const existing=prev.findIndex(item=>item.id===track.id&&(item.source||"youtube")===(track.source||"youtube"));
      if(existing>=0){
        setIndex(existing);
        return prev;
      }
      const nextQueue=[...prev,track];
      setIndex(nextQueue.length-1);
      return nextQueue;
    });
    setPlaying(true);
  },[]);

  const enqueue=useCallback((track:GlobalTrack)=>{
    setQueue(prev=>dedupe([...prev,track]));
    if(index<0)setIndex(0);
  },[index]);

  const toggle=useCallback(()=>{
    if(!current)return;
    setPlaying(value=>!value);
  },[current]);

  const stop=useCallback(()=>{
    setPlaying(false);
    postCommand("stopVideo");
  },[postCommand]);

  const addToPlaylist=useCallback((track:GlobalTrack)=>{
    setPlaylist(prev=>dedupe([...prev,track]));
  },[]);

  const removeFromPlaylist=useCallback((id:string)=>{
    setPlaylist(prev=>prev.filter(item=>item.id!==id));
  },[]);

  const playPlaylist=useCallback(()=>{
    if(!playlist.length)return;
    setQueue(playlist);
    setIndex(0);
    setPlaying(true);
    setExpanded(false);
  },[playlist]);

  const clearQueue=useCallback(()=>{
    setPlaying(false);
    postCommand("stopVideo");
    setQueue([]);
    setIndex(-1);
  },[postCommand]);

  const iframeSrc=current
    ? `https://www.youtube.com/embed/${encodeURIComponent(current.id)}?enablejsapi=1&playsinline=1&rel=0&autoplay=0`
    : "";

  const value=useMemo<PlayerContextValue>(()=>({
    current,queue,playlist,playing,expanded,
    playNow,enqueue,previous,next,toggle,stop,
    toggleExpanded:()=>setExpanded(v=>!v),
    addToPlaylist,removeFromPlaylist,playPlaylist,clearQueue
  }),[current,queue,playlist,playing,expanded,playNow,enqueue,previous,next,toggle,stop,addToPlaylist,removeFromPlaylist,playPlaylist,clearQueue]);

  return <PlayerContext.Provider value={value}>
    {children}
    {current&&<aside className={"crz-global-music "+(expanded?"is-expanded":"")} aria-label="Player de música global">
      <div className="crz-global-music__player">
        <div className="crz-global-music__video">
          <iframe
            key={current.id}
            ref={iframeRef}
            src={iframeSrc}
            title={current.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            onLoad={()=>{
              iframeRef.current?.contentWindow?.postMessage(JSON.stringify({event:"listening",id:"crz-global-music"}),"*");
              if(playing)setTimeout(()=>postCommand("playVideo"),80);
            }}
          />
        </div>
        <div className="crz-global-music__meta">
          <span>{current.source==="youtube-music"?"YOUTUBE MUSIC":"YOUTUBE"} • PIP</span>
          <strong>{current.title}</strong>
          <small>{current.channel}</small>
          <div className="crz-global-music__controls">
            <button onClick={previous} aria-label="Música anterior">◀</button>
            <button className="is-main" onClick={toggle}>{playing?"❚❚":"▶"}</button>
            <button onClick={next} aria-label="Próxima música">▶</button>
            <button onClick={()=>setExpanded(v=>!v)}>{expanded?"FECHAR":"FILA"}</button>
            <button onClick={()=>addToPlaylist(current)}>＋ PLAYLIST</button>
          </div>
        </div>
      </div>
      {expanded&&<div className="crz-global-music__drawer">
        <section>
          <header><strong>FILA</strong><button onClick={clearQueue}>Limpar</button></header>
          <div className="crz-global-music__list">
            {queue.map((track,i)=><button key={track.id+"-"+i} className={i===index?"is-active":""} onClick={()=>{setIndex(i);setPlaying(true)}}>
              <img src={track.thumbnail} alt=""/>
              <span><b>{track.title}</b><small>{track.channel}</small></span>
            </button>)}
          </div>
        </section>
        <section>
          <header><strong>MINHA PLAYLIST</strong>{playlist.length>0&&<button onClick={playPlaylist}>Tocar tudo</button>}</header>
          <div className="crz-global-music__list">
            {playlist.length===0&&<p>Salve músicas aqui para ouvir depois.</p>}
            {playlist.map(track=><div key={track.id} className="crz-global-music__saved">
              <button onClick={()=>playNow(track)}>
                <img src={track.thumbnail} alt=""/>
                <span><b>{track.title}</b><small>{track.channel}</small></span>
              </button>
              <button onClick={()=>removeFromPlaylist(track.id)} aria-label="Remover da playlist">×</button>
            </div>)}
          </div>
        </section>
      </div>}
    </aside>}
  </PlayerContext.Provider>;
}
