export function HeroSection() {
  return (
    <section className="hero-reference" aria-labelledby="hero-title">
      <h1 id="hero-title" className="sr-only">CRAZZY PROJECT</h1>
      <p className="sr-only">Jogos. Pessoas. Cultura. Sempre juntos.</p>

      <a
        href="#produtos"
        className="hero-hotspot hero-hotspot-primary"
        aria-label="Explorar Produtos"
      />
      <a
        href="#comunidade"
        className="hero-hotspot hero-hotspot-secondary"
        aria-label="Entrar na Comunidade"
      />
    </section>
  );
}
