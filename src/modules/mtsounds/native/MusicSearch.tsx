"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Copy, Download, ExternalLink, Loader2, Pause, Play, Search, Youtube } from "./icons";
import ReactiveVinyl from "./ReactiveVinyl";

type Video = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  publishedAt?: string;
};

function getYouTubeId(value:string){
  try{
    const url=new URL(value);
    if(url.hostname.includes("youtu.be")) return url.pathname.slice(1).split("/")[0] || null;
    if(url.hostname==="youtube.com" || url.hostname.endsWith(".youtube.com")){
      if(url.pathname==="/watch") return url.searchParams.get("v");
      if(url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || null;
      if(url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2] || null;
    }
  }catch{}
  return null;
}

export default function MusicSearch(){
  const frameRef=useRef<HTMLIFrameElement>(null);
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<Video[]>([]);
  const [selected,setSelected]=useState<Video|null>(null);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [playing,setPlaying]=useState(false);

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

    const directId=getYouTubeId(q);
    if(directId){
      const item={id:directId,title:"Link do YouTube",channel:"Vídeo selecionado",thumbnail:`https://i.ytimg.com/vi/${directId}/hqdefault.jpg`};
      setResults([item]);setSelected(item);setMessage("");broadcastPlayback(false);return;
    }

    setLoading(true);setMessage("");
    try{
      const r=await fetch("/api/mtsounds/native/youtube/search?q="+encodeURIComponent(q));
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||"Não foi possível buscar agora.");
      setResults(data.results||[]);
      setSelected((data.results||[])[0]||null);
      broadcastPlayback(false);
      if(!data.results?.length)setMessage("Nenhum resultado encontrado.");
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
    window.open("/api/mtsounds/native/downloader?url="+encodeURIComponent(url),"_blank","noopener,noreferrer");
  }

  return <section className="music-discovery wrap" id="buscar">
    <div className="discovery-copy">
      <span className="eyebrow">ESCOLHA O PRÓXIMO SOM</span>
      <h2>O que vai <span>tocar hoje?</span></h2>
      <p>Pesquise pelo nome ou cole um link do YouTube. Escute primeiro, escolha a faixa e depois leve pro Studio.</p>
      <form className="music-searchbar" onSubmit={submit}>
        <Search size={19}/>
        <input aria-label="Buscar música" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome da música ou link do YouTube"/>
        <button disabled={loading}>{loading?<Loader2 className="spin" size={18}/>:<><span>Buscar</span><Youtube size={18}/></>}</button>
      </form>
      {message&&<div className="search-message">{message}</div>}
    </div>

    <div className="discovery-grid">
      <div className="search-results glass">
        <div className="search-results-head"><b>Resultados</b><span>{results.length?results.length+" encontrados":"pronto pra buscar"}</span></div>
        <div className="result-list">
          {results.length===0&&<div className="search-empty"><Youtube size={32}/><p>Procure aquela faixa que combina com a próxima cena do servidor.</p></div>}
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
          <div className="player-info"><div><b>{selected.title}</b><span>{selected.channel}</span></div><span className="player-live-state">{playing?"TOCANDO":"PRONTO"}</span></div>
          <div className="player-actions">
            <button onClick={()=>setPlayback(!playing)}>{playing?<><Pause size={16}/> Pausar</>:<><Play size={16}/> Tocar</>}</button>
            <button onClick={()=>navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${selected.id}`)}><Copy size={16}/> Copiar link</button>
            <a href={`https://www.youtube.com/watch?v=${selected.id}`} target="_blank" rel="noreferrer"><ExternalLink size={16}/> YouTube</a>
            <button className="download-choice" onClick={()=>copyAndOpen(selected)}><Download size={16}/> Baixar música</button>
          </div>
        </>:<div className="player-placeholder"><ReactiveVinyl size="compact" showSignal={false}/><b>O próximo som começa aqui</b><p>Escolha uma faixa e dá o play.</p></div>}
      </div>
    </div>
  </section>;
}
