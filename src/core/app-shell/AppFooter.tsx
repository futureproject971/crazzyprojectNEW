const socials = [
  { label: "Discord", icon: "/icons/social-discord.svg" },
  { label: "Instagram", icon: "/icons/social-instagram.svg" },
  { label: "YouTube", icon: "/icons/social-youtube.svg" },
  { label: "TikTok", icon: "/icons/social-tiktok.svg" },
  { label: "X", icon: "/icons/social-x.svg" },
];

const footerLinks = [
  { label: "Produtos", href: "/produtos" },
  { label: "Contas", href: "/contas" },
  { label: "Feedbacks", href: "/feedbacks" },
  { label: "Comunidade", href: "/comunidade" },
  { label: "CRAZZY CALL", href: "/call" },
  { label: "Suporte", href: "/tickets" },
  { label: "Status", href: "/status" },
  { label: "Academy", href: "/academy" },
  { label: "Ajuda", href: "/help" },
  { label: "MT Sounds", href: "/mtsounds" },
];

export function AppFooter() {
  return (
    <footer className="crz-shell-footer">
      <div className="crz-shell-footer__glow" aria-hidden="true" />

      <div className="crz-shell-footer__inner">
        <div className="crz-shell-footer__brand">
          <img src="/brand/crazzy-logo-hero.png" alt="CRAZZY PROJECT" />
          <div>
            <strong>CRAZZY PROJECT</strong>
            <p>Produtos digitais, comunidade e suporte em um só lugar.</p>
          </div>
        </div>

        <nav className="crz-shell-footer__links" aria-label="Links do rodapé">
          {footerLinks.map((item) => (
            <a href={item.href} key={item.href}>{item.label}</a>
          ))}
        </nav>

        <div className="crz-shell-footer__social">
          <span>Siga a CRAZZY PROJECT</span>
          <div>
            {socials.map((item) => (
              <a href="#" aria-label={item.label} key={item.label}>
                <img src={item.icon} alt="" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="crz-shell-footer__bottom">
        <span>© {new Date().getFullYear()} CRAZZY PROJECT</span>
        <a className="crz-shell-footer__status" href="/status"><i /> Ver status dos serviços</a>
        <strong>GAMERS BUILD A BETTER TOMORROW</strong>
      </div>
    </footer>
  );
}
