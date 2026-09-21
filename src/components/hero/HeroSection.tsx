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
