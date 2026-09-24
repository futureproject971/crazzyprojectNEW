"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Copy, Download, ExternalLink, Loader2, Pause, Play, Search, Youtube } from "./icons";
import ReactiveVinyl from "./ReactiveVinyl";
import { useGlobalMusic, type GlobalTrack, type GlobalTrackSource } from "@/core/music/GlobalMusicProvider";

type Video = GlobalTrack & { publishedAt?: string };

function getYouTubeTarget(value:string):{id:string;source:GlobalTrackSource}|null{
  try{
    const url=new URL(value);
    const host=url.hostname.replace(/^www\./,"");
    const source:GlobalTrackSource=host==="music.youtube.com"?"youtube-music":"youtube";
    if(host==="youtu.be"){
      const id=url.pathname.slice(1).split("/")[0];
      return id?{id,source}:null;
    }
    if(host==="youtube.com"||host.endsWith(".youtube.com")){
      let id:string|null=null;
      if(url.pathname==="/watch")id=url.searchParams.get("v");
      else if(url.pathname.startsWith("/shorts/"))id=url.pathname.split("/")[2]||null;
      else if(url.pathname.startsWith("/embed/"))id=url.pathname.split("/")[2]||null;
      return id?{id,source}:null;
    }
  }catch{}
  return null;
}

export default function MusicSearch(){
  const frameRef=useRef<HTMLIFrameElement>(null);
  const globalPlayer=useGlobalMusic();
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<Video[]>([]);
  const [selected,setSelected]=useState<Video|null>(null);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [playing,setPlaying]=useState(false);
  const [sourceMode,setSourceMode]=useState<GlobalTrackSource>("youtube");

  function broadcastPlayback(next:boolean){
    setPlaying(next);
    window.dispatchEvent(new CustomEvent("mtsounds:playback",{detail:{playing:next}}));
    if(!next)window.dispatchEvent(new CustomEvent("mtsounds:audiolevel",{detail:{bass:0,level:0}}));
  }

  function setPlayback(next:boolean){
    broadcastPlayback(next);
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({
      event:"command",
      func:next?"playVideo":"pauseVideo",
      args:[]
    }),"*");
  }

  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(!event.origin.includes("youtube.com")&&!event.origin.includes("youtube-nocookie.com"))return;
      try{
        const data=typeof event.data==="string"?JSON.parse(event.data):event.data;
        if(data?.event!=="onStateChange")return;
        if(data.info===1)broadcastPlayback(true);
        if(data.info===0||data.info===2)broadcastPlayback(false);
      }catch{}
    };
    window.addEventListener("message",receive);
    return()=>window.removeEventListener("message",receive);
  },[]);

  function listenToFrame(){
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({event:"listening",id:"mtsounds-youtube"}),"*");
  }

  async function submit(e:FormEvent){
    e.preventDefault();
    const q=query.trim();
    if(!q)return;

    const direct=getYouTubeTarget(q);
    if(direct){
      const item:Video={
        id:direct.id,
        title:direct.source==="youtube-music"?"Faixa do YouTube Music":"Link do YouTube",
        channel:direct.source==="youtube-music"?"YouTube Music":"YouTube",
        thumbnail:`https://i.ytimg.com/vi/${direct.id}/hqdefault.jpg`,
        source:direct.source
      };
      setSourceMode(direct.source);
      setResults([item]);setSelected(item);setMessage("");broadcastPlayback(false);return;
    }

    setLoading(true);setMessage("");
    try{
      const searchQuery=sourceMode==="youtube-music"?q+" música":q;
      const r=await fetch("/api/mtsounds/native/youtube/search?q="+encodeURIComponent(searchQuery));
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||"Não foi possível buscar agora.");
      const normalized:Video[]=(data.results||[]).map((item:Video)=>({...item,source:sourceMode}));
      setResults(normalized);
      setSelected(normalized[0]||null);
      broadcastPlayback(false);
      if(!normalized.length)setMessage("Nenhum resultado encontrado.");
    }catch(err){
      setMessage(err instanceof Error?err.message:"Não foi possível buscar agora.");
    }finally{
      setLoading(false);
    }
  }

  function chooseVideo(video:Video){
    broadcastPlayback(false);
    setSelected(video);
  }

  async function copyAndOpen(video:Video){
    const url=`https://www.youtube.com/watch?v=${video.id}`;
    try{
      await navigator.clipboard.writeText(url);
      setMessage("Link copiado. Abrindo o downloader…");
    }catch{
      setMessage("Abrindo o downloader…");
    }
    window.open("https://y2meta.is/pt93/youtube-to-mp3/","_blank","noopener,noreferrer");
  }

  function playAcrossSite(video:Video){
    setPlayback(false);
    globalPlayer.playNow(video);
    setMessage("Tocando no player do site. Pode navegar sem interromper a música.");
  }

  return <section className="music-discovery wrap" id="buscar">
    <div className="discovery-copy">
      <span className="eyebrow">BUSCAR MÚSICA</span>
      <h2>Encontre a faixa.<br/><span>Personalize no Studio.</span></h2>
      <p>Pesquise no YouTube ou YouTube Music, organize sua fila e leve a música para editar para MTA ou FiveM.</p>

      <div className="mts-source-switch" role="group" aria-label="Fonte da música">
        <button className={sourceMode==="youtube"?"is-active":""} onClick={()=>setSourceMode("youtube")}><Youtube size={15}/> YouTube</button>
        <button className={sourceMode==="youtube-music"?"is-active":""} onClick={()=>setSourceMode("youtube-music")}><Youtube size={15}/> YouTube Music</button>
      </div>

      <form className="music-searchbar" onSubmit={submit}>
        <Search size={19}/>
        <input aria-label="Buscar música" value={query} onChange={e=>setQuery(e.target.value)} placeholder={sourceMode==="youtube-music"?"Nome da música ou link do YouTube Music":"Nome da música ou link do YouTube"}/>
        <button disabled={loading}>{loading?<Loader2 className="spin" size={18}/>:<><span>Buscar</span><Youtube size={18}/></>}</button>
      </form>
      {message&&<div className="search-message">{message}</div>}
    </div>

    <div className="discovery-grid">
      <div className="search-results glass">
        <div className="search-results-head"><b>Resultados</b><span>{results.length?results.length+" encontrados":"pronto pra buscar"}</span></div>
        <div className="result-list">
          {results.length===0&&<div className="search-empty"><Youtube size={32}/><p>Busque uma faixa para ouvir, colocar na fila ou editar no Studio.</p></div>}
          {results.map(video=><button key={video.id} className={"video-result "+(selected?.id===video.id?"active":"")} onClick={()=>chooseVideo(video)}>
            <img src={video.thumbnail} alt="" loading="lazy"/>
            <span><b>{video.title}</b><small>{video.channel}</small></span>
            <Play size={16}/>
          </button>)}
        </div>
      </div>

      <div className={"music-player glass "+(playing?"is-playing":"")}>
        {selected?<>
          <div className="youtube-frame">
            <iframe
              ref={frameRef}
              id="mtsounds-youtube"
              src={`https://www.youtube.com/embed/${selected.id}?rel=0&enablejsapi=1&playsinline=1`}
              title={selected.title}
              onLoad={listenToFrame}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            <div className="player-vinyl-badge" aria-hidden="true"><ReactiveVinyl size="compact" showSignal={false}/></div>
          </div>
          <div className="player-info"><div><b>{selected.title}</b><span>{selected.channel}</span></div><span className="player-live-state">{playing?"PRÉVIA TOCANDO":"PRONTO"}</span></div>
          <div className="player-actions">
            <button className="download-choice" onClick={()=>playAcrossSite(selected)}><Play size={16}/> Tocar no site</button>
            <button onClick={()=>globalPlayer.enqueue(selected)}>＋ Fila</button>
            <button onClick={()=>globalPlayer.addToPlaylist(selected)}>♡ Playlist</button>
            <button onClick={()=>setPlayback(!playing)}>{playing?<><Pause size={16}/> Pausar prévia</>:<><Play size={16}/> Prévia</>}</button>
            <button onClick={()=>navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${selected.id}`)}><Copy size={16}/> Copiar link</button>
            <a href={selected.source==="youtube-music"?`https://music.youtube.com/watch?v=${selected.id}`:`https://www.youtube.com/watch?v=${selected.id}`} target="_blank" rel="noreferrer"><ExternalLink size={16}/> {selected.source==="youtube-music"?"YouTube Music":"YouTube"}</a>
            <button onClick={()=>copyAndOpen(selected)}><Download size={16}/> Baixar</button>
          </div>
        </>:<div className="player-placeholder"><ReactiveVinyl size="compact" showSignal={false}/><b>Escolha uma música</b><p>Você pode ouvir aqui ou mandar para o player global do site.</p></div>}
      </div>
    </div>
  </section>;
}
