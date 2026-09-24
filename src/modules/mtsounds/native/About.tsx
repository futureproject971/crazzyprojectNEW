import { AudioLines, Search, SlidersHorizontal } from "./icons";

export default function About(){
  return <section className="page wrap">
    <span className="eyebrow">SOBRE A MTSOUND&apos;S</span>
    <h1>Som com identidade.<br/><span>Feito pro MTA:SA.</span></h1>
    <p className="lead">A MTSound&apos;s junta descoberta de músicas e edição de áudio numa experiência pensada para quem quer dar personalidade ao próprio servidor.</p>
    <div className="feature-grid about-grid">
      <article className="feature-card"><Search/><h3>Escolha a faixa</h3><p>Pesquise no YouTube, escute e encontre o som certo sem sair da central.</p></article>
      <article className="feature-card"><SlidersHorizontal/><h3>Leve pro Studio</h3><p>Corte, bass boost, distorção, echo, reverb, filtro, velocidade e fades em tempo real.</p></article>
      <article className="feature-card"><AudioLines/><h3>Exporte sua versão</h3><p>Prepare o WAV final com a intro oficial MTSound&apos;s antes do trecho editado.</p></article>
    </div>
  </section>;
}
