export function Footer() {
  const socials = [
    { label: "Discord", glyph: "◉" },
    { label: "Instagram", glyph: "◎" },
    { label: "YouTube", glyph: "▶" },
    { label: "TikTok", glyph: "♪" },
    { label: "X", glyph: "𝕏" },
  ];

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src="/brand/crazzy-logo-navbar.png" alt="CRAZZY PROJECT" />
          <p>Jogos. Pessoas. Cultura. Sempre juntos.</p>
        </div>

        <div className="footer-social">
          <span>Siga a CRAZZY PROJECT</span>
          <div>
            {socials.map((item) => (
              <a href="#" aria-label={item.label} key={item.label}>{item.glyph}</a>
            ))}
          </div>
        </div>

        <div className="footer-art">
          <strong>GAMERS<br />BUILD A<br />BETTER TOMORROW</strong>
          <span>東京</span>
        </div>
      </div>
    </footer>
  );
}
