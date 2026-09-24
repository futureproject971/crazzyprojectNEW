import type { ShellMode, ShellNavItem } from "./types";

export const visitorNavigation: ShellNavItem[] = [
  { id: "home", label: "Início", href: "/", icon: "/icons/home.svg" },
  { id: "products", label: "Produtos", href: "/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "combo", label: "Combo", href: "/combo", icon: "/icons/crown.svg" },
  { id: "accounts", label: "Contas", href: "/contas", icon: "/icons/package.svg" },
  { id: "community", label: "Comunidade", href: "/comunidade", icon: "/icons/users.svg" },
  { id: "call", label: "CRAZZY CALL", href: "/call", icon: "/icons/headset.svg" },
  { id: "mtsounds", label: "MTSOUNDS", href: "/mtsounds", icon: "/icons/bolt.svg", badge: "GRÁTIS" },
  { id: "cart", label: "Carrinho", href: "/carrinho", icon: "/icons/shopping-cart.svg" },
];

export const clientNavigation: ShellNavItem[] = [
  { id: "home", label: "Início", href: "/", icon: "/icons/home.svg" },
  { id: "products", label: "Produtos", href: "/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "combo", label: "Combo", href: "/combo", icon: "/icons/crown.svg" },
  { id: "accounts", label: "Contas", href: "/contas", icon: "/icons/package.svg" },
  { id: "community", label: "Comunidade", href: "/comunidade", icon: "/icons/users.svg" },
  { id: "call", label: "CRAZZY CALL", href: "/call", icon: "/icons/headset.svg" },
  { id: "mtsounds", label: "MTSOUNDS", href: "/mtsounds", icon: "/icons/bolt.svg", badge: "GRÁTIS" },
  { id: "cart", label: "Carrinho", href: "/carrinho", icon: "/icons/shopping-cart.svg" },
];

export const adminNavigation: ShellNavItem[] = [
  { id: "admin", label: "Control", href: "/admin", icon: "/icons/home.svg" },
  { id: "products", label: "Produtos", href: "/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "categories", label: "Categorias", href: "/categorias", icon: "/icons/neon-v2/gamepad.svg" },
  { id: "community", label: "Comunidade", href: "/comunidade", icon: "/icons/users.svg" },
  { id: "call", label: "CRAZZY CALL", href: "/call", icon: "/icons/headset.svg" },
  { id: "mtsounds", label: "MTSOUNDS", href: "/mtsounds", icon: "/icons/bolt.svg", badge: "GRÁTIS" },
  { id: "cart", label: "Carrinho", href: "/carrinho", icon: "/icons/shopping-cart.svg" },
];

export function getNavigation(mode: ShellMode): ShellNavItem[] {
  if (mode === "client") return clientNavigation;
  if (mode === "admin") return adminNavigation;
  return visitorNavigation;
}
