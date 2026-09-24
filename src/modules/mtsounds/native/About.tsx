import { AudioLines, Search, SlidersHorizontal } from "./icons";

export default function About(){
  return <section className="page wrap">
    <span className="eyebrow">SOBRE A MTSOUND&apos;S</span>
    <h1>Edite sua música.<br/><span>Use no MTA ou FiveM.</span></h1>
    <p className="lead">A MTSound&apos;s reúne busca, prévia, edição e exportação de áudio em um só lugar para projetos de MTA e FiveM.</p>
    <div className="feature-grid about-grid">
      <article className="feature-card"><Search/><h3>Escolha a faixa</h3><p>Busque no YouTube ou YouTube Music e escolha a faixa que quer editar.</p></article>
      <article className="feature-card"><SlidersHorizontal/><h3>Leve pro Studio</h3><p>Corte o trecho e ajuste grave, distorção, echo, reverb, filtro, velocidade e fades.</p></article>
      <article className="feature-card"><AudioLines/><h3>Exporte sua versão</h3><p>Exporte o WAV final pronto para usar no seu servidor.</p></article>
    </div>
  </section>;
}
