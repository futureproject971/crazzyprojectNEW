import type { ShellMode, ShellNavItem } from "./types";

export const visitorNavigation: ShellNavItem[] = [
  { id: "home", label: "Início", href: "/", icon: "/icons/home.svg" },
  { id: "products", label: "Produtos", href: "/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "combo", label: "Combo", href: "/combo", icon: "/icons/crown.svg" },
  { id: "accounts", label: "Contas", href: "/contas", icon: "/icons/package.svg" },
  { id: "community", label: "Comunidade", href: "/comunidade", icon: "/icons/users.svg" },
  { id: "call", label: "CRAZZY CALL", href: "/call", icon: "/icons/headset.svg" },
  { id: "cart", label: "Carrinho", href: "/carrinho", icon: "/icons/shopping-cart.svg" },
  { id: "mtsounds", label: "MTSOUNDS", href: "/mtsounds", icon: "/icons/bolt.svg", badge: "GRÁTIS" },
];

export const clientNavigation: ShellNavItem[] = [
  { id: "home", label: "Início", href: "/", icon: "/icons/home.svg" },
  { id: "products", label: "Produtos", href: "/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "combo", label: "Combo", href: "/combo", icon: "/icons/crown.svg" },
  { id: "accounts", label: "Contas", href: "/contas", icon: "/icons/package.svg" },
  { id: "community", label: "Comunidade", href: "/comunidade", icon: "/icons/users.svg" },
  { id: "call", label: "CRAZZY CALL", href: "/call", icon: "/icons/headset.svg" },
  { id: "cart", label: "Carrinho", href: "/carrinho", icon: "/icons/shopping-cart.svg" },
  { id: "mtsounds", label: "MTSOUNDS", href: "/mtsounds", icon: "/icons/bolt.svg", badge: "GRÁTIS" },
];

// Catálogo interno das ferramentas administrativas.
// Ele existe para rotas, smoke tests e o launchpad /admin, mas NÃO substitui
// a experiência de cliente no header quando o usuário também é administrador.
export const adminNavigation: ShellNavItem[] = [
  { id: "admin", label: "Painel Admin", href: "/admin", icon: "/icons/home.svg" },
  { id: "admin-products", label: "Produtos", href: "/admin/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "admin-categories", label: "Categorias", href: "/admin/categorias", icon: "/icons/neon-v2/gamepad.svg" },
  { id: "admin-sales", label: "Vendas", href: "/admin/vendas", icon: "/icons/shopping-cart.svg" },
  { id: "admin-payments", label: "Pagamentos", href: "/admin/pagamentos", icon: "/icons/credit-card.svg" },
  { id: "admin-finance", label: "Financeiro", href: "/admin/finance", icon: "/icons/credit-card.svg" },
  { id: "admin-fulfillment", label: "Entregas", href: "/admin/fulfillment", icon: "/icons/package.svg" },
  { id: "admin-campaigns", label: "Campanhas", href: "/admin/campanhas", icon: "/icons/flame.svg" },
  { id: "admin-bonus", label: "Bônus", href: "/admin/bonus", icon: "/icons/crown.svg" },
  { id: "admin-arcade", label: "Arcade", href: "/admin/luck", icon: "/icons/bolt.svg" },
  { id: "admin-calls", label: "CRAZZY CALL Admin", href: "/admin/calls", icon: "/icons/headset.svg" },
  { id: "admin-integrations", label: "Integrações", href: "/admin/integracoes", icon: "/icons/bolt.svg" },
  { id: "admin-appearance", label: "Marca & Aparência", href: "/admin/aparencia", icon: "/icons/diamond.svg" },
];

export function getNavigation(mode: ShellMode): ShellNavItem[] {
  if (mode === "client") return clientNavigation;
  if (mode === "admin") return clientNavigation;
  return visitorNavigation;
}
