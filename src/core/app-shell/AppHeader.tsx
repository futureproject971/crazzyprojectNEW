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

function go(path: string) {
  window.location.assign(path);
}

export function AppHeader({
  mode = "visitor",
  activeNav = "home",
  cartCount: fallbackCartCount = 0,
  userName = "Meu QG",
}: {
  mode?: ShellMode;
  activeNav?: string;
  cartCount?: number;
  userName?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { totalQuantity, hydrated } = useCart();
  const {
    user,
    loading: authLoading,
    signIn,
    signOut,
    discordEnabled,
    googleEnabled,
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
          { id: "admin-settings", label: "Configurações", onSelect: () => go("/admin/configuracoes") },
          { id: "admin-signout", label: "Sair", danger: true, onSelect: () => void signOut() },
        ]
      : [
          { id: "client-dashboard", label: "Meu QG", onSelect: () => go("/painel") },
          { id: "client-orders", label: "Meu Arsenal", onSelect: () => go("/painel/pedidos") },
          { id: "client-library", label: "Minha Bag", onSelect: () => go("/biblioteca") },
          { id: "client-tickets", label: "Meu Suporte", onSelect: () => go("/tickets") },
          { id: "client-club", label: "CRAZZY CLUB", onSelect: () => go("/club") },
          { id: "client-coupons", label: "Meus Cupons 🔥", onSelect: () => go("/painel/cupons") },
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
          <button
            type="button"
            className="crz-shell-theme"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          >
            <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
          </button>
          {!user ? (
            <>
              <a href="/login" className="crz-shell-auth crz-shell-auth--compact">
                <LineIcon name="user" size={14} />
                <span>{authLoading ? "Só um segundo..." : "BORA ENTRAR"}</span>
              </a>

              {googleEnabled && (
                <button
                  type="button"
                  className="crz-shell-auth"
                  disabled={authLoading}
                  onClick={() => void signIn("google", window.location.pathname)}
                >
                  <img src="/icons/brand-google.svg" alt="" aria-hidden="true" />
                  <span>ENTRAR COM GOOGLE</span>
                </button>
              )}

              {discordEnabled && (
                <button
                  type="button"
                  className="crz-shell-auth"
                  disabled={authLoading}
                  onClick={() => void signIn("discord", window.location.pathname)}
                >
                  <img src="/icons/brand-discord.svg" alt="" aria-hidden="true" />
                  <span>ENTRAR COM DISCORD</span>
                </button>
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

          <button
            type="button"
            className="crz-shell-mobile__theme"
            onClick={toggleTheme}
          >
            <span>{theme === "dark" ? "☀" : "☾"}</span>
            {theme === "dark" ? "Acender o mapa" : "Voltar pro underground"}
          </button>

          <div className="crz-shell-mobile__account">
            {!user ? (
              <>
                <a className="crz-button crz-button--primary crz-button--md" href="/login">
                  Entrar
                </a>
                {discordEnabled && (
                  <button
                    type="button"
                    className="crz-button crz-button--secondary crz-button--md"
                    onClick={() => void signIn("discord", window.location.pathname)}
                  >
                    Discord
                  </button>
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
