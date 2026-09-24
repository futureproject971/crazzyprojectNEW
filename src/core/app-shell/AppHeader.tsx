"use client";

import { useState } from "react";
import { Drawer, Dropdown, LineIcon } from "@/core/design-system";
import { useAuth } from "@/modules/auth/AuthProvider";
import { useCart } from "@/modules/cart/CartProvider";
import { getNavigation } from "./navigation";
import { useTheme } from "@/core/theme/ThemeProvider";
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
            className={compact ? `crz-shell-mobile-link ${item.id === "mtsounds" ? "is-mtsounds" : ""}` : `crz-shell-nav__item ${item.id === "mtsounds" ? "is-mtsounds" : ""} ${item.subtitle ? "has-subtitle" : ""} ${isActive ? "is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
          >
            <ShellIcon src={item.icon} />
            <span className="crz-shell-nav__copy">
              <span>{item.label}</span>
              {item.subtitle && <small>{item.subtitle}</small>}
            </span>
            {badge && <b>{badge}</b>}
          </a>
        );
      })}
    </nav>
  );
}

function go(path: string) {
  window.location.assign(path);
}

export function AppHeader({
  mode = "visitor",
  activeNav = "home",
  cartCount: fallbackCartCount = 0,
  userName = "Meu Painel",
}: {
  mode?: ShellMode;
  activeNav?: string;
  cartCount?: number;
  userName?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme, allowThemeToggle } = useTheme();
  const { totalQuantity, hydrated } = useCart();
  const {
    user,
    loading: authLoading,
    signIn,
    signOut,
    discordEnabled,
  } = useAuth();

  const cartCount = hydrated ? totalQuantity : fallbackCartCount;
  const effectiveMode: ShellMode = user
    ? user.role === "admin"
      ? "admin"
      : "client"
    : mode === "admin"
      ? "visitor"
      : mode;
  const items = getNavigation(effectiveMode);
  const displayName = user?.username || userName;

  const accountItems =
    effectiveMode === "admin"
      ? [
          { id: "admin-dashboard", label: "Dashboard", onSelect: () => go("/admin") },
          { id: "admin-products", label: "Produtos", onSelect: () => go("/admin/produtos") },
          { id: "admin-orders", label: "Pedidos", onSelect: () => go("/admin/pedidos") },
          { id: "admin-users", label: "Usuários", onSelect: () => go("/admin/usuarios") },
          { id: "admin-partners", label: "Parceiros", onSelect: () => go("/admin/parceiros") },
          { id: "admin-notifications", label: "Notificações", onSelect: () => go("/admin/notificacoes") },
          { id: "admin-security", label: "Security Sentinel", onSelect: () => go("/admin/security") },
          { id: "admin-settings", label: "Configurações", onSelect: () => go("/admin/integracoes") },
          { id: "admin-signout", label: "Sair", danger: true, onSelect: () => void signOut() },
        ]
      : [
          { id: "client-dashboard", label: "Painel do Cliente", onSelect: () => go("/painel") },
          { id: "client-orders", label: "Minhas Compras", onSelect: () => go("/painel/pedidos") },
          { id: "client-library", label: "Minha Biblioteca", onSelect: () => go("/biblioteca") },
          { id: "client-tickets", label: "Meus Tickets", onSelect: () => go("/tickets") },
          { id: "client-club", label: "CRAZZY CLUB", onSelect: () => go("/club") },
          { id: "client-coupons", label: "Meus Cupons", onSelect: () => go("/painel/cupons") },
          { id: "client-notifications", label: "Notificações", onSelect: () => go("/painel/notificacoes") },
          { id: "client-tutorial", label: "Tutorial", onSelect: () => go("/academy") },
          { id: "client-profile", label: "Meu Perfil", onSelect: () => go("/perfil") },
          { id: "client-signout", label: "Sair", danger: true, onSelect: () => void signOut() },
        ];

  return (
    <>
      <header className="crz-shell-header">
        <div className="crz-shell-header__main">
          <a className="crz-shell-brand" href="/" aria-label="CRAZZY PROJECT, início">
            <img src="/brand/crazzy-logo-hero.png" alt="CRAZZY PROJECT" />
          </a>

          <NavLinks items={items} activeNav={activeNav} cartCount={cartCount} />

          {effectiveMode !== "visitor" && (
            <button type="button" className="crz-shell-search" aria-label="Pesquisar">
              <ShellIcon src="/icons/search.svg" />
            </button>
          )}
        </div>

        <div className="crz-shell-header__account" aria-label="Conta e acesso">
          {allowThemeToggle && (
            <button
              type="button"
              className="crz-shell-theme"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              title={theme === "dark" ? "Tema claro" : "Tema escuro"}
            >
              <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
            </button>
          )}
          {!user ? (
            <>
              {discordEnabled ? (
                <button
                  type="button"
                  className="crz-shell-auth crz-shell-auth--discord"
                  disabled={authLoading}
                  onClick={() => void signIn("discord", window.location.pathname)}
                >
                  <img src="/icons/brand-discord.svg" alt="" aria-hidden="true" />
                  <span>{authLoading ? "Verificando..." : "Entrar com Discord"}</span>
                </button>
              ) : (
                <a href="/login" className="crz-shell-auth">
                  <LineIcon name="user" size={14} />
                  <span>Discord indisponível</span>
                </a>
              )}
            </>
          ) : (
            <Dropdown
              items={accountItems}
              trigger={
                <span className="crz-shell-user">
                  <span className="crz-shell-user__avatar" aria-hidden="true">
                    {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
                  </span>
                  <span>{displayName}</span>
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
          <img className="crz-shell-mobile__logo" src="/brand/crazzy-logo-hero.png" alt="CRAZZY PROJECT" />

          <NavLinks
            items={items}
            activeNav={activeNav}
            cartCount={cartCount}
            compact
            onNavigate={() => setMobileOpen(false)}
          />

          {allowThemeToggle && (
            <button
              type="button"
              className="crz-shell-mobile__theme"
              onClick={toggleTheme}
            >
              <span>{theme === "dark" ? "☀" : "☾"}</span>
              {theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
            </button>
          )}

          <div className="crz-shell-mobile__account">
            {!user ? (
              <>
                {discordEnabled ? (
                  <button
                    type="button"
                    className="crz-button crz-button--primary crz-button--md"
                    onClick={() => void signIn("discord", window.location.pathname)}
                  >
                    <img src="/icons/brand-discord.svg" alt="" aria-hidden="true" />
                    Entrar com Discord
                  </button>
                ) : (
                  <a className="crz-button crz-button--primary crz-button--md" href="/login">
                    Discord indisponível
                  </a>
                )}
              </>
            ) : (
              <>
                <a className="crz-button crz-button--secondary crz-button--md" href="/painel">
                  {displayName}
                </a>
                <button
                  type="button"
                  className="crz-button crz-button--ghost crz-button--md"
                  onClick={() => void signOut()}
                >
                  Sair
                </button>
              </>
            )}
          </div>
        </div>
      </Drawer>
    </>
  );
}
