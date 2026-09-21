import type { ShellMode, ShellNavItem } from "./types";

export const visitorNavigation: ShellNavItem[] = [
  { id: "home", label: "Início", href: "/", icon: "/icons/home.svg" },
  { id: "products", label: "Produtos", href: "/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "combo", label: "Combo", href: "/combo", icon: "/icons/crown.svg" },
  { id: "accounts", label: "Contas", href: "/contas", icon: "/icons/package.svg" },
  { id: "news", label: "Novidades", href: "/novidades", icon: "/icons/flame.svg" },
  { id: "feedbacks", label: "Feedbacks", href: "/feedbacks", icon: "/icons/star.svg" },
  { id: "community", label: "Comunidade", href: "/comunidade", icon: "/icons/users.svg" },
  { id: "club", label: "CLUB", href: "/club", icon: "/icons/crown.svg" },
  { id: "cart", label: "Carrinho", href: "/carrinho", icon: "/icons/shopping-cart.svg" },
  { id: "ticket", label: "Ticket", href: "/tickets", icon: "/icons/headset.svg" },
];

export const clientNavigation: ShellNavItem[] = [
  { id: "home", label: "Início", href: "/", icon: "/icons/home.svg" },
  { id: "products", label: "Produtos", href: "/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "combo", label: "Combo", href: "/combo", icon: "/icons/crown.svg" },
  { id: "accounts", label: "Contas", href: "/contas", icon: "/icons/package.svg" },
  { id: "community", label: "Comunidade", href: "/comunidade", icon: "/icons/users.svg" },
  { id: "support", label: "Suporte", href: "/tickets", icon: "/icons/headset.svg" },
  { id: "cart", label: "Carrinho", href: "/carrinho", icon: "/icons/shopping-cart.svg" },
];

export const adminNavigation: ShellNavItem[] = [
  { id: "admin", label: "Admin", href: "#inicio", icon: "/icons/home.svg" },
  { id: "products", label: "Produtos", href: "#produtos", icon: "/icons/shopping-bag.svg" },
  { id: "orders", label: "Pedidos", href: "#produtos", icon: "/icons/package.svg" },
  { id: "users", label: "Usuários", href: "#comunidade", icon: "/icons/users.svg" },
];

export function getNavigation(mode: ShellMode): ShellNavItem[] {
  if (mode === "client") return clientNavigation;
  if (mode === "admin") return adminNavigation;
  return visitorNavigation;
}
