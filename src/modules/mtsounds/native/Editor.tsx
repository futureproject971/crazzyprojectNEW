"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Gauge, Headphones, LockKeyhole, Pause, Play, RotateCcw, Scissors, Sparkles, Upload, Volume2, Waves } from "./icons";
import { INTRO_MP3_BASE64 } from "./introData";
import ReactiveVinyl from "./ReactiveVinyl";

type FX = { bass:BiquadFilterNode; dist:WaveShaperNode; low:BiquadFilterNode; dry:GainNode; delay:DelayNode; feedback:GainNode; echoWet:GainNode; conv:ConvolverNode; reverbWet:GainNode; master:GainNode; analyser:AnalyserNode };

function curve(amount:number){const n=44100,c=new Float32Array(n),k=Math.max(0,amount)*8;for(let i=0;i<n;i++){const x=i*2/n-1;c[i]=(1+k)*x/(1+k*Math.abs(x));}return c;}
function impulse(ctx:BaseAudioContext,seconds=2,decay=2.7){const len=Math.floor(ctx.sampleRate*seconds),b=ctx.createBuffer(2,len,ctx.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);}return b;}
function fmt(s:number){if(!Number.isFinite(s))return"0:00";return Math.floor(s/60)+":"+Math.floor(s%60).toString().padStart(2,"0");}
function introBlob(){const bin=atob(INTRO_MP3_BASE64);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:"audio/mpeg"});}
const yieldUI=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
async function wavAsync(buffer:AudioBuffer,onProgress?:(value:number)=>void){
  const ch=buffer.numberOfChannels,rate=buffer.sampleRate,len=buffer.length,block=ch*2,size=len*block;
  const ab=new ArrayBuffer(44+size),v=new DataView(ab);
  const write=(o:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  write(0,"RIFF");v.setUint32(4,36+size,true);write(8,"WAVE");write(12,"fmt ");
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch,true);v.setUint32(24,rate,true);
  v.setUint32(28,rate*block,true);v.setUint16(32,block,true);v.setUint16(34,16,true);write(36,"data");v.setUint32(40,size,true);
  const data=Array.from({length:ch},(_,i)=>buffer.getChannelData(i));
  let o=44;
  const chunk=65536;
  let lastProgress=75;
  for(let from=0;from<len;from+=chunk){
    const to=Math.min(len,from+chunk);
    for(let i=from;i<to;i++)for(let channel=0;channel<ch;channel++){
      const sample=Math.max(-1,Math.min(1,data[channel][i]));
      v.setInt16(o,sample<0?sample*0x8000:sample*0x7fff,true);o+=2;
    }
    const progress=Math.min(99,75+Math.round((to/len)*24));
    if(progress!==lastProgress){lastProgress=progress;onProgress?.(progress);}
    await yieldUI();
  }
  return new Blob([ab],{type:"audio/wav"});
}

export default function Editor(){
  const audio=useRef<HTMLAudioElement>(null),introAudio=useRef<HTMLAudioElement>(null),ctx=useRef<AudioContext|null>(null),src=useRef<MediaElementAudioSourceNode|null>(null),fx=useRef<FX|null>(null),meterRaf=useRef<number|null>(null);
  const [file,setFile]=useState<File|null>(null),[url,setUrl]=useState(""),[introUrl,setIntroUrl]=useState(""),[name,setName]=useState("Nenhuma música carregada"),[duration,setDuration]=useState(0),[current,setCurrent]=useState(0),[peaks,setPeaks]=useState<number[]>([]),[busy,setBusy]=useState(false),[playingFinal,setPlayingFinal]=useState(false),[exportProgress,setExportProgress]=useState(0),[exportError,setExportError]=useState(""),[downloadUrl,setDownloadUrl]=useState("");
  const [volume,setVolume]=useState(100),[bass,setBass]=useState(0),[distortion,setDistortion]=useState(0),[echo,setEcho]=useState(0),[delay,setDelay]=useState(.28),[feedback,setFeedback]=useState(28),[reverb,setReverb]=useState(0),[lowpass,setLowpass]=useState(20000),[speed,setSpeed]=useState(1),[start,setStart]=useState(0),[end,setEnd]=useState(0),[fadeIn,setFadeIn]=useState(0),[fadeOut,setFadeOut]=useState(0);
  const bars=useMemo(()=>peaks.length?peaks:Array.from({length:110},(_,i)=>.12+Math.abs(Math.sin(i*.51))*.42),[peaks]);

  function graph(){if(!audio.current)return;if(!ctx.current)ctx.current=new AudioContext();if(src.current)return;const c=ctx.current,s=c.createMediaElementSource(audio.current),b=c.createBiquadFilter(),d=c.createWaveShaper(),l=c.createBiquadFilter(),dry=c.createGain(),de=c.createDelay(2),fb=c.createGain(),ew=c.createGain(),cv=c.createConvolver(),rw=c.createGain(),m=c.createGain(),an=c.createAnalyser();b.type="lowshelf";b.frequency.value=150;l.type="lowpass";cv.buffer=impulse(c);an.fftSize=1024;an.smoothingTimeConstant=.72;s.connect(b);b.connect(d);d.connect(l);l.connect(dry);dry.connect(m);l.connect(de);de.connect(ew);ew.connect(m);de.connect(fb);fb.connect(de);l.connect(cv);cv.connect(rw);rw.connect(m);m.connect(an);an.connect(c.destination);src.current=s;fx.current={bass:b,dist:d,low:l,dry,delay:de,feedback:fb,echoWet:ew,conv:cv,reverbWet:rw,master:m,analyser:an};apply();}
  function apply(){const n=fx.current;if(!n)return;n.bass.gain.value=bass;n.dist.curve=curve(distortion);n.dist.oversample="4x";n.low.frequency.value=lowpass;n.delay.delayTime.value=delay;n.feedback.gain.value=Math.min(.85,feedback/100);n.echoWet.gain.value=echo/100;n.reverbWet.gain.value=reverb/100;n.master.gain.value=volume/100;if(audio.current)audio.current.playbackRate=speed;}
  function stopMeter(){if(meterRaf.current!==null){cancelAnimationFrame(meterRaf.current);meterRaf.current=null;}window.dispatchEvent(new CustomEvent("mtsounds:audiolevel",{detail:{bass:0,level:0}}));}
  function startMeter(){
    const context=ctx.current,node=fx.current?.analyser;
    if(!context||!node||meterRaf.current!==null)return;
    const data=new Uint8Array(node.frequencyBinCount);
    const tick=()=>{
      if(!audio.current||audio.current.paused){stopMeter();return;}
      node.getByteFrequencyData(data);
      const binHz=context.sampleRate/node.fftSize;
      const lowStart=Math.max(1,Math.floor(35/binHz));
      const lowEnd=Math.min(data.length-1,Math.ceil(180/binHz));
      const bodyEnd=Math.min(data.length-1,Math.ceil(4000/binHz));
      let bassSum=0,bassCount=0,levelSum=0,levelCount=0;
      for(let i=lowStart;i<=lowEnd;i++){bassSum+=data[i];bassCount++;}
      for(let i=1;i<=bodyEnd;i++){levelSum+=data[i];levelCount++;}
      const bassLevel=Math.min(1,(bassSum/Math.max(1,bassCount))/210);
      const overall=Math.min(1,(levelSum/Math.max(1,levelCount))/190);
      window.dispatchEvent(new CustomEvent("mtsounds:audiolevel",{detail:{bass:bassLevel,level:overall}}));
      meterRaf.current=requestAnimationFrame(tick);
    };
    meterRaf.current=requestAnimationFrame(tick);
  }
  useEffect(()=>{apply();const intensity=.72+(volume/180)*.25+(Math.max(0,bass)/30)*.35+(distortion/100)*.25+(reverb/100)*.18;window.dispatchEvent(new CustomEvent("mtsounds:fx",{detail:{intensity}}));},[volume,bass,distortion,echo,delay,feedback,reverb,lowpass,speed]);
  useEffect(()=>{const u=URL.createObjectURL(introBlob());setIntroUrl(u);return()=>{URL.revokeObjectURL(u);if(meterRaf.current!==null)cancelAnimationFrame(meterRaf.current);};},[]);

  async function choose(f?:File){if(!f)return;if(url)URL.revokeObjectURL(url);const u=URL.createObjectURL(f);setFile(f);setUrl(u);setName(f.name);const raw=await f.arrayBuffer(),temp=new AudioContext(),buf=await temp.decodeAudioData(raw.slice(0));setDuration(buf.duration);setStart(0);setEnd(buf.duration);const data=buf.getChannelData(0),count=120,step=Math.max(1,Math.floor(data.length/count)),p:number[]=[];for(let i=0;i<count;i++){let max=0;for(let j=i*step;j<Math.min(data.length,(i+1)*step);j++)max=Math.max(max,Math.abs(data[j]));p.push(max);}setPeaks(p);await temp.close();}
  async function play(){if(!file||!audio.current)return;graph();await ctx.current?.resume();apply();if(audio.current.currentTime<start||audio.current.currentTime>=end)audio.current.currentTime=start;await audio.current.play();window.dispatchEvent(new CustomEvent("mtsounds:playback",{detail:{playing:true}}));startMeter();}
  function stop(){audio.current?.pause();introAudio.current?.pause();setPlayingFinal(false);stopMeter();window.dispatchEvent(new CustomEvent("mtsounds:playback",{detail:{playing:false}}));}
  async function previewFinal(){if(!file||!introAudio.current)return;stop();setPlayingFinal(true);introAudio.current.currentTime=0;await introAudio.current.play();window.dispatchEvent(new CustomEvent("mtsounds:playback",{detail:{playing:true}}));introAudio.current.onended=async()=>{if(!audio.current)return;graph();await ctx.current?.resume();audio.current.currentTime=start;apply();await audio.current.play();startMeter();};}
  function preset(k:"original"|"bass"|"blown"|"hall"){if(k==="original"){setVolume(100);setBass(0);setDistortion(0);setEcho(0);setReverb(0);setLowpass(20000);}if(k==="bass"){setVolume(110);setBass(16);setDistortion(6);setEcho(0);setReverb(0);}if(k==="blown"){setVolume(128);setBass(26);setDistortion(68);setLowpass(16000);}if(k==="hall"){setEcho(18);setDelay(.2);setFeedback(22);setReverb(62);}}
  async function exportFinal(){
    if(!file||busy)return;
    if(downloadUrl){URL.revokeObjectURL(downloadUrl);setDownloadUrl("");}
    setBusy(true);setExportError("");setExportProgress(3);

    try{
      await yieldUI();
      const decoder=new AudioContext();
      const [mainRaw,introRaw]=await Promise.all([file.arrayBuffer(),introBlob().arrayBuffer()]);
      setExportProgress(8);await yieldUI();

      const [main,intro]=await Promise.all([
        decoder.decodeAudioData(mainRaw.slice(0)),
        decoder.decodeAudioData(introRaw.slice(0))
      ]);
      await decoder.close();

      const decodedBytes=main.length*main.numberOfChannels*4;
      if(decodedBytes>650*1024*1024)throw new Error("Essa faixa é grande demais para processar inteira no navegador. Corte um trecho menor e tente novamente.");

      const s=Math.max(0,Math.min(start,main.duration));
      const e=Math.max(s+.05,Math.min(end||main.duration,main.duration));
      const slice=e-s;
      const outDur=slice/speed;
      const rate=main.sampleRate;
      const channels=Math.min(2,Math.max(main.numberOfChannels,intro.numberOfChannels));
      const frames=Math.max(1,Math.ceil(outDur*rate));

      setExportProgress(15);await yieldUI();

      const off=new OfflineAudioContext(channels,frames,rate);
      const source=off.createBufferSource();source.buffer=main;source.playbackRate.value=speed;
      const b=off.createBiquadFilter(),d=off.createWaveShaper(),l=off.createBiquadFilter(),dry=off.createGain(),de=off.createDelay(2),fb=off.createGain(),ew=off.createGain(),cv=off.createConvolver(),rw=off.createGain(),m=off.createGain();
      b.type="lowshelf";b.frequency.value=150;b.gain.value=bass;
      d.curve=curve(distortion);d.oversample="4x";
      l.type="lowpass";l.frequency.value=lowpass;
      dry.gain.value=1;de.delayTime.value=delay;fb.gain.value=Math.min(.85,feedback/100);
      ew.gain.value=echo/100;cv.buffer=impulse(off);rw.gain.value=reverb/100;

      source.connect(b);b.connect(d);d.connect(l);
      l.connect(dry);dry.connect(m);
      l.connect(de);de.connect(ew);ew.connect(m);de.connect(fb);fb.connect(de);
      l.connect(cv);cv.connect(rw);rw.connect(m);m.connect(off.destination);

      const target=volume/100,fi=Math.min(fadeIn,outDur/2),fo=Math.min(fadeOut,outDur/2);
      m.gain.setValueAtTime(fi>0?0:target,0);
      if(fi>0)m.gain.linearRampToValueAtTime(target,fi);
      if(fo>0){m.gain.setValueAtTime(target,Math.max(fi,outDur-fo));m.gain.linearRampToValueAtTime(0,outDur);}

      source.start(0,s,slice);
      setExportProgress(30);await yieldUI();
      const processed=await off.startRendering();

      setExportProgress(58);await yieldUI();

      const gap=.03;
      const finalDuration=intro.duration+gap+processed.duration;
      const totalFrames=Math.max(1,Math.ceil(finalDuration*rate));
      const mix=new OfflineAudioContext(channels,totalFrames,rate);
      const introSource=mix.createBufferSource();introSource.buffer=intro;introSource.connect(mix.destination);
      const musicSource=mix.createBufferSource();musicSource.buffer=processed;musicSource.connect(mix.destination);
      introSource.start(0);
      musicSource.start(intro.duration+gap);

      const final=await mix.startRendering();
      setExportProgress(75);await yieldUI();

      const blob=await wavAsync(final,setExportProgress);
      const readyUrl=URL.createObjectURL(blob);
      setDownloadUrl(readyUrl);
      setExportProgress(100);
    }catch(error){
      setExportError(error instanceof Error?error.message:"Não consegui exportar essa música.");
      setExportProgress(0);
    }finally{
      setBusy(false);
    }
  }

  return <section className="crz-mts-native studio-page wrap">
    <div className="studio-head"><div><span className="eyebrow">MTSOUND&apos;S STUDIO</span><h1>Edite para <span>MTA e FiveM.</span></h1><p>Corte a faixa, ajuste o áudio, aplique efeitos e exporte sua versão final.</p></div><label className="upload"><Upload size={17}/> Carregar música<input type="file" accept="audio/*" onChange={e=>choose(e.target.files?.[0])}/></label></div>
    <div className="intro-lock"><div className="lock-icon"><LockKeyhole/></div><div><b>Intro oficial MTSound&apos;s</b><span>Incluída automaticamente na exportação.</span></div><button onClick={()=>{if(introAudio.current){introAudio.current.currentTime=0;introAudio.current.play();}}}><Headphones size={15}/> ouvir</button></div>
    <audio ref={introAudio} src={introUrl} />

    <div className="editor-layout">
      <div className="editor-main">
        <section className="glass panel-main">
          <div className="track-row"><div className="track-name"><span className="music-dot"/><div><b>{name}</b><small>{fmt(current)} / {fmt(duration)}</small></div></div><div className="transport"><button onClick={play}><Play size={17}/></button><button onClick={stop}><Pause size={17}/></button><button className="preview-final" onClick={previewFinal}><Sparkles size={15}/>{playingFinal?"tocando final":"preview final"}</button></div></div>
          <div className="waveform" onClick={e=>{if(!audio.current||!duration)return;const r=e.currentTarget.getBoundingClientRect(),t=((e.clientX-r.left)/r.width)*duration;audio.current.currentTime=t;setCurrent(t);}}>{bars.map((p,i)=><i key={i} style={{height:(10+p*118)+"px"}}/>)}</div>
          <audio ref={audio} src={url} onPlay={()=>{window.dispatchEvent(new CustomEvent("mtsounds:playback",{detail:{playing:true}}));startMeter();}} onPause={()=>{stopMeter();window.dispatchEvent(new CustomEvent("mtsounds:playback",{detail:{playing:false}}));}} onEnded={()=>{stopMeter();setPlayingFinal(false);window.dispatchEvent(new CustomEvent("mtsounds:playback",{detail:{playing:false}}));}} onTimeUpdate={e=>{const a=e.currentTarget;setCurrent(a.currentTime);if(end&&a.currentTime>=end){a.pause();setPlayingFinal(false);}}}/>
          <div className="time-strip"><span>{fmt(start)}</span><div/><span>{fmt(end||duration)}</span></div>
        </section>

        <section className="glass fx-section"><div className="panel-title"><div><Sparkles/><span><b>Presets</b><small>ajustes rápidos</small></span></div></div><div className="preset-row"><button onClick={()=>preset("original")}>Original</button><button onClick={()=>preset("bass")}>Bass Boost</button><button onClick={()=>preset("blown")}>💥 Grave Estourado</button><button onClick={()=>preset("hall")}>Hall / Reverb</button></div></section>

        <section className="glass fx-section"><div className="panel-title"><div><Gauge/><span><b>Aplique efeitos</b><small>personalize o áudio</small></span></div><button className="reset" onClick={()=>preset("original")}><RotateCcw size={15}/> resetar</button></div><div className="controls-grid">
          <Control label="Volume" hint="Controle de ganho" value={volume} suffix="%" min={0} max={180} set={setVolume}/><Control label="Bass Boost" hint="Graves potentes" value={bass} suffix=" dB" min={-12} max={30} set={setBass}/><Control label="Distorção" hint="Som / grave estourado" value={distortion} suffix="%" min={0} max={100} set={setDistortion}/><Control label="Reverb" hint="Eco ambiente" value={reverb} suffix="%" min={0} max={100} set={setReverb}/><Control label="Echo" hint="Delay molhado" value={echo} suffix="%" min={0} max={100} set={setEcho}/><Control label="Feedback" hint="Repetição do eco" value={feedback} suffix="%" min={0} max={85} set={setFeedback}/><Control label="Low Pass" hint="Abafa frequências" value={lowpass} suffix=" Hz" min={500} max={20000} step={100} set={setLowpass}/><Control label="Velocidade" hint="Pitch temporal" value={speed} suffix="x" min={.5} max={1.5} step={.05} set={setSpeed}/>
        </div></section>

        <section className="glass fx-section"><div className="panel-title"><div><Waves/><span><b>Fade in / Fade out</b><small>controle de entrada e saída</small></span></div></div><div className="fade-row"><Control label="Fade In" hint="segundos" value={fadeIn} suffix="s" min={0} max={10} step={.1} set={setFadeIn}/><Control label="Fade Out" hint="segundos" value={fadeOut} suffix="s" min={0} max={10} step={.1} set={setFadeOut}/></div></section>

        <section className="glass fx-section"><div className="panel-title"><div><Scissors/><span><b>Ferramenta de corte</b><small>selecione o trecho da música</small></span></div></div><div className="trim-grid"><div><label>Início <b>{fmt(start)}</b></label><input aria-label="Início do corte" type="range" min="0" max={Math.max(.1,duration)} step=".01" value={start} onChange={e=>setStart(Math.min(+e.target.value,end-.05))}/></div><div><label>Fim <b>{fmt(end||duration)}</b></label><input aria-label="Fim do corte" type="range" min="0" max={Math.max(.1,duration)} step=".01" value={end} onChange={e=>setEnd(Math.max(+e.target.value,start+.05))}/></div></div></section>
      </div>

      <aside className="glass export-card"><div className="editor-vinyl"><ReactiveVinyl/></div><div className="export-orb"><Volume2/></div><span className="eyebrow">EXPORT</span><h3>Pronto para exportar?</h3><p>Gere o WAV final com o trecho e os efeitos que você configurou.</p><div className="export-flow"><span>INTRO 🔒</span><i>→</i><span>FX</span><i>→</i><span>WAV</span></div>
        {busy&&<div className="export-progress"><div><span>Processando áudio</span><b>{exportProgress}%</b></div><progress max="100" value={exportProgress}/><small>Preparando o arquivo final.</small></div>}
        {exportError&&<div className="export-error">{exportError}</div>}
        {!downloadUrl?<button className="export-btn" disabled={!file||busy} onClick={exportFinal}><Download size={18}/>{busy?"Processando...":"Preparar áudio final"}</button>:<a className="export-btn export-ready" href={downloadUrl} download={name.replace(/\.[^.]+$/,"")+"_MTSounds.wav"} onClick={()=>setTimeout(()=>{URL.revokeObjectURL(downloadUrl);setDownloadUrl("");setExportProgress(0);},1500)}><Download size={18}/> Baixar arquivo pronto</a>}
        <small>{downloadUrl?"Arquivo pronto. Clique em baixar para salvar no dispositivo.":"A exportação é feita localmente e em blocos para não congelar o site."}</small></aside>
    </div>
  </section>;
}

function Control({label,hint,value,suffix,min,max,step=1,set}:{label:string;hint:string;value:number;suffix:string;min:number;max:number;step?:number;set:(v:number)=>void}){return <div className="control-card"><div className="control-label"><span><b>{label}</b><small>{hint}</small></span><strong>{step<1?value.toFixed(2):Math.round(value)}{suffix}</strong></div><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>set(+e.target.value)}/><div className="range-minmax"><span>{min}{suffix}</span><span>{max}{suffix}</span></div></div>}
