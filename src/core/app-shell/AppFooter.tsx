const socials = [
  { label: "Discord", icon: "/icons/social-discord.svg" },
  { label: "Instagram", icon: "/icons/social-instagram.svg" },
  { label: "YouTube", icon: "/icons/social-youtube.svg" },
  { label: "TikTok", icon: "/icons/social-tiktok.svg" },
  { label: "X", icon: "/icons/social-x.svg" },
];

export function AppFooter() {
  return (
    <footer className="crz-shell-footer">
      <div className="crz-shell-footer__inner">
        <div className="crz-shell-footer__brand">
          <img src="/brand/crazzy-logo-navbar.png" alt="CRAZZY PROJECT" />
          <p>Jogos. Pessoas. Cultura. Sempre juntos.</p>
        </div>

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

        <div className="crz-shell-footer__art" aria-hidden="true">
          <strong>GAMERS<br />BUILD A<br />BETTER TOMORROW</strong>
          <span>東京</span>
        </div>
      </div>
    </footer>
  );
}
