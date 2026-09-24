import Link from "next/link";
import { Activity, AudioLines, ArrowUpRight, Gauge, Radio, Search, SlidersHorizontal, Sparkles, Waves } from "./native/icons";
import MusicSearch from "./native/MusicSearch";
import ReactiveVinyl from "./native/ReactiveVinyl";

export function MtSoundsPage() {
  return <div className="crz-mts-native">
    <section className="command-hero wrap">
      <div className="hero-copy reveal">
        <span className="system-kicker"><Activity size={15}/> MTSOUND&apos;S / MTA:SA AUDIO</span>
        <h1>SEU SERVIDOR.<br/><span>SEU SOM.</span></h1>
        <p className="lead">Escolha a faixa, acerte o grave e deixe o servidor reconhecer sua presença antes mesmo do carro chegar.</p>
        <div className="hero-quick-actions">
          <Link href="/mtsounds#buscar" className="btn-primary"><Search size={18}/> Escolher uma música</Link>
          <Link href="/mtsounds/editor" className="btn-ghost"><SlidersHorizontal size={18}/> Abrir Studio</Link>
        </div>
      </div>

      <div className="command-grid">
        <section className="master-module reveal delay-1">
          <div className="module-chrome" aria-hidden="true"/>
          <div className="vinyl-bay">
            <span className="bay-label">VINYL REACTOR / LIVE</span>
            <ReactiveVinyl />
          </div>
          <div className="master-copy">
            <div className="live-monitor"><span className="monitor-bars"><i/><i/><i/><i/></span> REAGE AO PLAYER</div>
            <h2>O disco sente<br/>quando o grave bate.</h2>
            <p>Play faz girar. Pause segura o ângulo. No Studio, cada pancada de grave acelera, pulsa e ilumina o vinil em tempo real.</p>
            <Link href="/mtsounds/editor" className="btn-primary"><SlidersHorizontal size={18}/> Testar no Studio</Link>
          </div>
        </section>

        <aside className="studio-module reveal delay-1">
          <div className="studio-module-head"><div><span className="studio-icon"><SlidersHorizontal size={17}/></span><b>MTS STUDIO</b></div><em>LIVE FX</em></div>
          <div className="studio-display">
            <div className="display-top"><span>VINYL REACTOR</span><b>SYNC</b></div>
            <div className="eq-bars" aria-hidden="true">{Array.from({length:28},(_,i)=><i key={i} style={{height:`${22+Math.abs(Math.sin(i*.7))*68}%`,animationDelay:`-${i*70}ms`}}/>)}</div>
            <div className="frequency"><span>40</span><span>100</span><span>1K</span><span>5K</span><span>16K HZ</span></div>
          </div>
          <div className="studio-reading"><span>FX ENGINE</span><b><i/> PRONTO</b></div>
          <Link href="/mtsounds/editor" className="studio-launch"><SlidersHorizontal size={17}/> ABRIR STUDIO</Link>
        </aside>
      </div>

      <div className="spec-grid">
        <div><Search/><span><small>BUSCA</small><b>YOUTUBE</b><em>Encontre e teste a faixa</em></span></div>
        <div><Waves/><span><small>FX LIVE</small><b>BASS + ECHO</b><em>Reverb, filtro e distorção</em></span></div>
        <div><Gauge/><span><small>EXPORT</small><b>WAV + INTRO</b><em>Arquivo final no navegador</em></span></div>
        <div><Radio/><span><small>MTA:SA</small><b>SUA IDENTIDADE</b><em>Som com a cara do projeto</em></span></div>
      </div>
    </section>

    <MusicSearch />

    <section className="wrap premium-studio-cta">
      <div className="studio-cta-glow" aria-hidden="true"/>
      <div>
        <span className="eyebrow"><Sparkles size={14}/> MTSOUND&apos;S STUDIO</span>
        <h2>Achou a faixa?<br/>Agora deixa ela <span>com a sua cara.</span></h2>
        <p>Corte o trecho, ajuste o peso do grave, aplique FX e exporte a versão final com a assinatura MTSound&apos;s.</p>
      </div>
      <Link href="/mtsounds/editor"><SlidersHorizontal size={18}/> Entrar no Studio <ArrowUpRight size={17}/></Link>
    </section>
  </div>;
}