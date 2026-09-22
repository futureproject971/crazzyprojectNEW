const heroPillars = [
  { icon: "/icons/neon-v2/gamepad.svg", label: "JOGOS", sublabel: "E CONTAS" },
  { icon: "/icons/neon-v2/gear.svg", label: "SOFTWARES", sublabel: "E FERRAMENTAS" },
  { icon: "/icons/neon-v2/crown.svg", label: "PRODUTOS", sublabel: "PREMIUM" },
  { icon: "/icons/neon-v2/book.svg", label: "STREAM", sublabel: "E CRIAÇÃO" },
];

export function HeroSection() {
  return (
    <section className="crz-home-hero" aria-labelledby="hero-title">
      <div className="crz-home-hero__backdrop" aria-hidden="true" />
      <div className="crz-home-hero__shade" aria-hidden="true" />

      <div className="crz-home-hero__agents" aria-hidden="true">
        <div className="crz-home-hero__agent-side crz-home-hero__agent-side--left">
          <img
            className="crz-home-hero__agent crz-home-hero__agent--gekko"
            src="https://media.valorant-api.com/agents/e370fa57-4757-3604-3648-499e1f642d3f/fullportrait.png"
            alt=""
          />
          <img
            className="crz-home-hero__agent crz-home-hero__agent--raze"
            src="https://media.valorant-api.com/agents/f94c3b30-42be-e959-889c-5aa313dba261/fullportrait.png"
            alt=""
          />
          <div className="crz-home-hero__smoke crz-home-hero__smoke--left" />
        </div>

        <div className="crz-home-hero__agent-side crz-home-hero__agent-side--right">
          <img
            className="crz-home-hero__agent crz-home-hero__agent--yoru"
            src="https://media.valorant-api.com/agents/7f94d92c-4234-0a36-9646-3a87eb8b5c89/fullportrait.png"
            alt=""
          />
          <img
            className="crz-home-hero__agent crz-home-hero__agent--chamber"
            src="https://media.valorant-api.com/agents/22697a3d-45bf-8dd7-4fec-84a9e28c69d7/fullportrait.png"
            alt=""
          />
          <div className="crz-home-hero__smoke crz-home-hero__smoke--right" />
        </div>
      </div>

      <div className="crz-home-hero__content">
        <img
          className="crz-home-hero__logo"
          src="/brand/crazzy-logo-hero.png"
          alt="CRAZZY PROJECT"
        />

        <h1 id="hero-title" className="sr-only">CRAZZY PROJECT</h1>

        <p className="crz-home-hero__tagline">
          JOGOS. PESSOAS. CULTURA. SEMPRE JUNTOS.
        </p>

        <div className="crz-home-hero__pillars" aria-label="Áreas CRAZZY PROJECT">
          {heroPillars.map((item) => (
            <div className="crz-home-hero__pillar" key={item.label}>
              <img src={item.icon} alt="" aria-hidden="true" />
              <span>
                <strong>{item.label}</strong>
                <small>{item.sublabel}</small>
              </span>
            </div>
          ))}
        </div>

        <div className="crz-home-hero__actions">
          <a className="crz-home-hero__cta crz-home-hero__cta--primary" href="#produtos">
            Explorar Produtos
            <span aria-hidden="true">→</span>
          </a>
          <a className="crz-home-hero__cta crz-home-hero__cta--secondary" href="#comunidade">
            <img src="/icons/brand-discord.svg" alt="" aria-hidden="true" />
            Entrar na Comunidade
          </a>
        </div>
      </div>

      <div className="crz-home-hero__graffiti crz-home-hero__graffiti--left" aria-hidden="true">
        GOOD GAMES<br />BETTER PEOPLE
      </div>
      <div className="crz-home-hero__graffiti crz-home-hero__graffiti--right" aria-hidden="true">
        SAME GAMES<br />DIFFERENT MENTALITY.
      </div>
    </section>
  );
}
