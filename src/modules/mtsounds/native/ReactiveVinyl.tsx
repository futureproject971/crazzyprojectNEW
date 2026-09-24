"use client";

import { useEffect, useRef, useState } from "react";

type VinylSize = "header" | "compact" | "hero";

type Props = {
  size?: VinylSize;
  showSignal?: boolean;
  className?: string;
};

type PlaybackDetail = { playing?: boolean };
type FxDetail = { intensity?: number };
type AudioLevelDetail = { bass?: number; level?: number };

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

export default function ReactiveVinyl({size="hero",showSignal=true,className=""}:Props){
  const orbitRef=useRef<HTMLDivElement>(null);
  const discRef=useRef<HTMLImageElement>(null);
  const rafRef=useRef<number|null>(null);
  const lastFrameRef=useRef(0);
  const angleRef=useRef(0);
  const speedRef=useRef(0);
  const playingRef=useRef(false);
  const bassRef=useRef(0);
  const levelRef=useRef(0);
  const fxRef=useRef(1);
  const [playing,setPlaying]=useState(false);

  useEffect(()=>{
    const run=(now:number)=>{
      const previous=lastFrameRef.current||now;
      const dt=Math.min(.05,(now-previous)/1000);
      lastFrameRef.current=now;

      const bass=clamp(bassRef.current,0,1);
      const level=clamp(levelRef.current,0,1);
      const fx=clamp(fxRef.current,.7,1.8);
      const target=playingRef.current
        ? 72+(level*46)+(bass*190)+(Math.max(0,fx-1)*36)
        : 0;

      const response=playingRef.current?4.8:10;
      speedRef.current+=(target-speedRef.current)*Math.min(1,dt*response);
      angleRef.current=(angleRef.current+speedRef.current*dt)%360;

      const kick=1+bass*.045+level*.012;
      if(discRef.current){
        discRef.current.style.transform=`rotate(${angleRef.current}deg) scale(${kick})`;
      }
      if(orbitRef.current){
        orbitRef.current.style.setProperty("--vinyl-bass",bass.toFixed(3));
        orbitRef.current.style.setProperty("--vinyl-level",level.toFixed(3));
        orbitRef.current.style.setProperty("--vinyl-fx",fx.toFixed(3));
        orbitRef.current.style.setProperty("--vinyl-rpm",(speedRef.current/6).toFixed(1));
      }

      if(playingRef.current||speedRef.current>.08){
        rafRef.current=requestAnimationFrame(run);
      }else{
        speedRef.current=0;
        lastFrameRef.current=0;
        rafRef.current=null;
      }
    };

    const ensureLoop=()=>{
      if(rafRef.current===null){
        lastFrameRef.current=0;
        rafRef.current=requestAnimationFrame(run);
      }
    };

    const onPlayback=(event:Event)=>{
      const next=Boolean((event as CustomEvent<PlaybackDetail>).detail?.playing);
      playingRef.current=next;
      setPlaying(next);
      if(!next){
        bassRef.current=0;
        levelRef.current=0;
      }
      ensureLoop();
    };

    const onFx=(event:Event)=>{
      fxRef.current=clamp((event as CustomEvent<FxDetail>).detail?.intensity??1,.7,1.8);
      ensureLoop();
    };

    const onAudioLevel=(event:Event)=>{
      const detail=(event as CustomEvent<AudioLevelDetail>).detail;
      bassRef.current=clamp(detail?.bass??0,0,1);
      levelRef.current=clamp(detail?.level??0,0,1);
      ensureLoop();
    };

    window.addEventListener("mtsounds:playback",onPlayback);
    window.addEventListener("mtsounds:fx",onFx);
    window.addEventListener("mtsounds:audiolevel",onAudioLevel);

    return()=>{
      window.removeEventListener("mtsounds:playback",onPlayback);
      window.removeEventListener("mtsounds:fx",onFx);
      window.removeEventListener("mtsounds:audiolevel",onAudioLevel);
      if(rafRef.current!==null)cancelAnimationFrame(rafRef.current);
    };
  },[]);

  return <div
    ref={orbitRef}
    className={`vinyl-orbit vinyl-${size} ${playing?"is-playing":"is-paused"} ${className}`.trim()}
    data-playing={playing?"true":"false"}
  >
    <span className="vinyl-reactor" aria-hidden="true"/>
    <span className="vinyl-groove-ring" aria-hidden="true"/>
    <img
      ref={discRef}
      className="vinyl-disc"
      src="https://raw.githubusercontent.com/futureproject971/mtsounds/main/public/assets/mtsounds-vinyl-full.webp"
      alt="Disco de vinil MTSound's"
      draggable={false}
    />
    <span className="vinyl-center-glow" aria-hidden="true"/>
    {showSignal&&<div className="signal-row" aria-hidden="true">
      {Array.from({length:18},(_,i)=><i key={i} style={{animationDelay:`${i*47}ms`}}/> )}
    </div>}
  </div>;
}
