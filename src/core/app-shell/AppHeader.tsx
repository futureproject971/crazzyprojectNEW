"use client";

import { useState } from "react";
import { Drawer, Dropdown, LineIcon } from "@/core/design-system";
import { getNavigation } from "./navigation";
import type { ShellMode, ShellNavItem } from "./types";

function ShellIcon({ src }: { src: string }) {
  return (
    <span
      className="crz-shell-icon"
      aria-hidden="true"
      style={{
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
      }}
    />
  );
}

function NavLinks({
  items,
  activeNav,
  cartCount,
  compact = false,
  onNavigate,
}: {
  items: ShellNavItem[];
  activeNav?: string;
  cartCount: number;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      className={compact ? "crz-shell-mobile-nav" : "crz-shell-nav"}
      aria-label={compact ? "Navegação móvel" : "Navegação principal"}
    >
      {items.map((item) => {
        const isActive = item.id === activeNav;
        const badge = item.id === "cart" && cartCount > 0 ? String(cartCount) : item.badge;

        return (
          <a
            key={item.id}
            href={item.href}
            className={compact ? "crz-shell-mobile-link" : `crz-shell-nav__item ${isActive ? "is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
          >
            <ShellIcon src={item.icon} />
            <span>{item.label}</span>
            {badge && <b>{badge}</b>}
          </a>
        );
      })}
    </nav>
  );
}

const clientAccountItems = [
  "Painel do Cliente",
  "Minhas Compras",
  "Meus Tickets",
  "CRAZZY CLUB",
  "Meus Cupons",
  "Tutorial",
  "Meu Perfil",
  "Notificações",
  "Sair",
];

const adminAccountItems = [
  "Dashboard",
  "Produtos",
  "Pedidos",
  "Usuários",
  "Configurações",
  "Sair",
];

export function AppHeader({
  mode = "visitor",
  activeNav = "home",
  cartCount = 0,
  userName = "Meu Painel",
}: {
  mode?: ShellMode;
  activeNav?: string;
  cartCount?: number;
  userName?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = getNavigation(mode);
  const accountItems = (mode === "admin" ? adminAccountItems : clientAccountItems).map((label, index, all) => ({
    id: `${mode}-account-${index}`,
    label,
    danger: index === all.length - 1,
  }));

  return (
    <>
      <header className="crz-shell-header">
        <div className="crz-shell-header__main">
          <a className="crz-shell-brand" href="#inicio" aria-label="CRAZZY PROJECT, início">
            <img src="/brand/crazzy-logo-navbar.png" alt="CRAZZY PROJECT" />
          </a>

          <NavLinks items={items} activeNav={activeNav} cartCount={cartCount} />

          {mode !== "visitor" && (
            <button type="button" className="crz-shell-search" aria-label="Pesquisar">
              <ShellIcon src="/icons/search.svg" />
            </button>
          )}
        </div>

        <div className="crz-shell-header__account" aria-label="Conta e acesso">
          {mode === "visitor" ? (
            <>
              <button type="button" className="crz-shell-auth crz-shell-auth--compact">
                <LineIcon name="user" size={14} />
                <span>Login</span>
              </button>
              <button type="button" className="crz-shell-auth">
                <img src="/icons/brand-google.svg" alt="" aria-hidden="true" />
                <span>Login com Google</span>
              </button>
              <button type="button" className="crz-shell-auth">
                <img src="/icons/brand-discord.svg" alt="" aria-hidden="true" />
                <span>Login com Discord</span>
              </button>
            </>
          ) : (
            <Dropdown
              items={accountItems}
              trigger={
                <span className="crz-shell-user">
                  <span className="crz-shell-user__avatar" aria-hidden="true" />
                  <span>{userName}</span>
                  <LineIcon name="user" size={14} />
                </span>
              }
            />
          )}
        </div>

        <button
          type="button"
          className="crz-shell-menu"
          aria-label="Abrir menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <Drawer open={mobileOpen} title="CRAZZY PROJECT" onClose={() => setMobileOpen(false)}>
        <div className="crz-shell-mobile">
          <img className="crz-shell-mobile__logo" src="/brand/crazzy-logo-navbar.png" alt="CRAZZY PROJECT" />

          <NavLinks
            items={items}
            activeNav={activeNav}
            cartCount={cartCount}
            compact
            onNavigate={() => setMobileOpen(false)}
          />

          <div className="crz-shell-mobile__account">
            {mode === "visitor" ? (
              <>
                <button type="button" className="crz-button crz-button--primary crz-button--md">Entrar</button>
                <button type="button" className="crz-button crz-button--secondary crz-button--md">Discord</button>
              </>
            ) : (
              <button type="button" className="crz-button crz-button--secondary crz-button--md">{userName}</button>
            )}
          </div>
        </div>
      </Drawer>
    </>
  );
}
