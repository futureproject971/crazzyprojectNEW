type IconMaskProps = {
  src: string;
  className?: string;
};

function IconMask({ src, className = "" }: IconMaskProps) {
  return (
    <span
      className={`icon-mask ${className}`}
      aria-hidden="true"
      style={{
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
      }}
    />
  );
}

const navItems = [
  { label: "Início", href: "#inicio", icon: "/icons/home.svg", active: true },
  { label: "Produtos", href: "#produtos", icon: "/icons/shopping-bag.svg" },
  { label: "Novidades", href: "#novidades", icon: "/icons/flame.svg" },
  { label: "Feedbacks", href: "#feedbacks", icon: "/icons/star.svg" },
  { label: "Comunidade", href: "#comunidade", icon: "/icons/users.svg" },
  {
    label: "Carrinho",
    href: "#carrinho",
    icon: "/icons/shopping-cart.svg",
    badge: "0",
  },
  { label: "Ticket", href: "#ticket", icon: "/icons/headset.svg" },
];

const authItems = [
  { label: "Login", icon: "/icons/user.svg" },
  { label: "Login com Google", icon: "/icons/brand-google.svg" },
  { label: "Login com Discord", icon: "/icons/brand-discord.svg" },
];

export function FloatingNavbar() {
  return (
    <header className="floating-navbar-wrap">
      <div className="floating-navbar">
        <a
          className="brand-lockup"
          href="#inicio"
          aria-label="CRAZZY PROJECT, início"
        >
          <img
            src="/brand/crazzy-logo-navbar.png"
            alt="CRAZZY PROJECT"
            className="brand-logo"
          />
        </a>

        <nav className="primary-nav" aria-label="Navegação principal">
          {navItems.map((item) => (
            <a
              key={item.label}
              className={`nav-item ${item.active ? "is-active" : ""}`}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
            >
              <IconMask src={item.icon} />
              <span className="nav-label">{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </a>
          ))}
        </nav>
      </div>

      <div className="auth-navbar" aria-label="Acesso à conta">
        {authItems.map((item, index) => (
          <button
            key={item.label}
            className={`auth-button ${index === 0 ? "auth-compact" : ""}`}
            type="button"
            aria-label={item.label}
          >
            <IconMask src={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </header>
  );
}
