import type { ShellMode, ShellNavItem } from "./types";

export const visitorNavigation: ShellNavItem[] = [
  { id: "home", label: "Início", href: "/", icon: "/icons/home.svg" },
  { id: "products", label: "Produtos", href: "/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "accounts", label: "Contas", href: "/contas", icon: "/icons/package.svg" },
  { id: "free", label: "FREE", href: "/club/rewards", icon: "/icons/bolt.svg", badge: "GRÁTIS" },
  { id: "prizes", label: "PRÊMIOS", href: "/club/luck", icon: "/icons/crown.svg", badge: "CLUB" },
  { id: "community", label: "Comunidade", href: "/comunidade", icon: "/icons/users.svg" },
  { id: "call", label: "CRAZZY CALL", href: "/call", icon: "/icons/headset.svg" },
  { id: "mtsounds", label: "MTSOUNDS", href: "/mtsounds", icon: "/icons/bolt.svg" },
  { id: "cart", label: "Carrinho", href: "/carrinho", icon: "/icons/shopping-cart.svg" },
];

export const clientNavigation: ShellNavItem[] = [
  { id: "home", label: "Início", href: "/", icon: "/icons/home.svg" },
  { id: "products", label: "Produtos", href: "/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "accounts", label: "Contas", href: "/contas", icon: "/icons/package.svg" },
  { id: "free", label: "FREE", href: "/club/rewards", icon: "/icons/bolt.svg", badge: "GRÁTIS" },
  { id: "prizes", label: "PRÊMIOS", href: "/club/luck", icon: "/icons/crown.svg", badge: "CLUB" },
  { id: "community", label: "Comunidade", href: "/comunidade", icon: "/icons/users.svg" },
  { id: "call", label: "CRAZZY CALL", href: "/call", icon: "/icons/headset.svg" },
  { id: "mtsounds", label: "MTSOUNDS", href: "/mtsounds", icon: "/icons/bolt.svg" },
  { id: "cart", label: "Carrinho", href: "/carrinho", icon: "/icons/shopping-cart.svg" },
];

// Catálogo interno das ferramentas administrativas.
// Ele existe para rotas, smoke tests e o launchpad /admin, mas NÃO substitui
// a experiência de cliente no header quando o usuário também é administrador.
export const adminNavigation: ShellNavItem[] = [
  { id: "admin", label: "Visão Geral", href: "/admin", icon: "/icons/home.svg" },
  { id: "admin-products", label: "Produtos", href: "/admin/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "admin-customers", label: "Clientes", href: "/admin/clientes", icon: "/icons/users.svg" },
  { id: "admin-sales", label: "Vendas", href: "/admin/vendas", icon: "/icons/shopping-cart.svg" },
  { id: "admin-club", label: "CRAZZY Club", href: "/admin/club", icon: "/icons/crown.svg" },
  { id: "admin-system", label: "Sistema", href: "/admin#sistema", icon: "/icons/shield-check.svg" },
];

export function getNavigation(mode: ShellMode): ShellNavItem[] {
  if (mode === "client") return clientNavigation;
  if (mode === "admin") return clientNavigation;
  return visitorNavigation;
}
