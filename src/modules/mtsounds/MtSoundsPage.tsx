"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Activity, AudioLines, ArrowUpRight, Gauge, Radio, Search, SlidersHorizontal, Sparkles, Waves } from "./native/icons";
import MusicSearch from "./native/MusicSearch";
import ReactiveVinyl from "./native/ReactiveVinyl";
import ReactiveBackground from "./native/ReactiveBackground";

export function MtSoundsPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const via = String(params.get("via") || "").trim().toLowerCase();
    if (!via) return;

    void fetch("/api/referral/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: via, source: "mtsounds" }),
    }).finally(() => {
      params.delete("via");
      const query = params.toString();
      window.history.replaceState({}, "", query ? "/mtsounds?" + query : "/mtsounds");
    });
  }, []);

  return <div className="crz-mts-native">
    <div className="mts-site-art-bg" aria-hidden="true"><img src="/mtsounds/assets/mtsounds-hero-full.webp" alt=""/></div>
    <ReactiveBackground />
    <div className="mts-inner-nav wrap">
      <div className="mts-brand"><ReactiveVinyl size="header" showSignal={false}/><span>MT<b>SOUND&apos;S</b></span></div>
      <div className="mts-tabs">
        <Link href="/mtsounds">Início</Link><Link href="/mtsounds#buscar">Músicas</Link><Link href="/mtsounds/editor">Studio</Link><Link href="/mtsounds/documentation">API</Link><Link href="/mtsounds/about">Sobre</Link>
      </div>
      <span className="mts-online"><i/> MTA / FIVEM</span>
    </div>
    <section className="command-hero wrap">
      <div className="hero-copy reveal">
        <span className="system-kicker"><Activity size={15}/> MTSOUND&apos;S • MTA & FIVEM AUDIO STUDIO</span>
        <h1>EDITE SUA MÚSICA.<br/><span>USE NO SERVIDOR.</span></h1>
        <p className="lead">Busque no YouTube ou YouTube Music, corte, personalize, aplique efeitos e exporte para MTA ou FiveM.</p>
        <div className="hero-quick-actions">
          <Link href="/mtsounds#buscar" className="btn-primary"><Search size={18}/> Escolher uma música</Link>
          <Link href="/mtsounds/editor" className="btn-ghost"><SlidersHorizontal size={18}/> Abrir Studio</Link>
        </div>
      </div>

      <div className="command-grid">
        <section className="master-module reveal delay-1">
          <div className="module-chrome" aria-hidden="true"/>
          <div className="vinyl-bay">
            <span className="bay-label">EDIÇÃO / PREVIEW</span>
            <ReactiveVinyl />
          </div>
          <div className="master-copy">
            <div className="live-monitor"><span className="monitor-bars"><i/><i/><i/><i/></span> MTS STUDIO</div>
            <h2>ESCOLHA. EDITE.<br/>EXPORTE.</h2>
            <p>Transforme a faixa para o seu servidor em um fluxo simples: prévia, corte, efeitos e exportação.</p>
            <Link href="/mtsounds/editor" className="btn-primary"><SlidersHorizontal size={18}/> Abrir MTS Studio</Link>
          </div>
        </section>

        <aside className="studio-module reveal delay-1">
          <div className="studio-module-head"><div><span className="studio-icon"><SlidersHorizontal size={17}/></span><b>MTS STUDIO</b></div><em>LIVE FX</em></div>
          <div className="studio-display">
            <div className="display-top"><span>AUDIO PREVIEW</span><b>SYNC</b></div>
            <div className="eq-bars" aria-hidden="true">{Array.from({length:28},(_,i)=><i key={i} style={{height:`${22+Math.abs(Math.sin(i*.7))*68}%`,animationDelay:`-${i*70}ms`}}/>)}</div>
            <div className="frequency"><span>40</span><span>100</span><span>1K</span><span>5K</span><span>16K HZ</span></div>
          </div>
          <div className="studio-reading"><span>FX ENGINE</span><b><i/> PRONTO</b></div>
          <Link href="/mtsounds/editor" className="studio-launch"><SlidersHorizontal size={17}/> ABRIR STUDIO</Link>
        </aside>
      </div>

      <div className="spec-grid">
        <div><Search/><span><small>BUSCA</small><b>YOUTUBE + MUSIC</b><em>Encontre a faixa</em></span></div>
        <div><Waves/><span><small>EDIÇÃO</small><b>CORTE + FX</b><em>Personalize o áudio</em></span></div>
        <div><Gauge/><span><small>EXPORTAÇÃO</small><b>WAV</b><em>Arquivo pronto para usar</em></span></div>
        <div><Radio/><span><small>MTA + FIVEM</small><b>PRONTO PRO SERVIDOR</b><em>Edite e use no projeto</em></span></div>
      </div>
    </section>

    <MusicSearch />

    <section className="wrap premium-studio-cta">
      <div className="studio-cta-glow" aria-hidden="true"/>
      <div>
        <span className="eyebrow"><Sparkles size={14}/> MTSOUND&apos;S STUDIO</span>
        <h2>Do YouTube<br/><span>pro seu servidor.</span></h2>
        <p>Abra no Studio, personalize o áudio e exporte a versão final para MTA ou FiveM.</p>
      </div>
      <Link href="/mtsounds/editor"><SlidersHorizontal size={18}/> Entrar no Studio <ArrowUpRight size={17}/></Link>
    </section>
  </div>;
}