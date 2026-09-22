import type { ShellMode, ShellNavItem } from "./types";

export const visitorNavigation: ShellNavItem[] = [
  { id: "home", label: "Início", href: "/", icon: "/icons/home.svg" },
  { id: "products", label: "Produtos", href: "/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "combo", label: "Combo", href: "/combo", icon: "/icons/crown.svg" },
  { id: "accounts", label: "Contas", href: "/contas", icon: "/icons/package.svg" },
  { id: "news", label: "Novidades", href: "/novidades", icon: "/icons/flame.svg" },
  { id: "feedbacks", label: "Feedbacks", href: "/feedbacks", icon: "/icons/star.svg" },
  { id: "community", label: "Comunidade", href: "/comunidade", icon: "/icons/users.svg" },
  { id: "call", label: "CRAZZY CALL", href: "/call", icon: "/icons/headset.svg" },
  { id: "club", label: "CLUB", href: "/club", icon: "/icons/crown.svg" },
  { id: "cart", label: "Carrinho", href: "/carrinho", icon: "/icons/shopping-cart.svg" },
  { id: "help", label: "Ajuda", href: "/help", icon: "/icons/book.svg" },
  { id: "ticket", label: "Ticket", href: "/tickets", icon: "/icons/headset.svg" },
  { id: "mtsounds", label: "MT Sounds", href: "/mtsounds", icon: "/icons/bolt.svg" },
];

export const clientNavigation: ShellNavItem[] = [
  { id: "home", label: "Início", href: "/", icon: "/icons/home.svg" },
  { id: "products", label: "Produtos", href: "/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "combo", label: "Combo", href: "/combo", icon: "/icons/crown.svg" },
  { id: "accounts", label: "Contas", href: "/contas", icon: "/icons/package.svg" },
  { id: "community", label: "Comunidade", href: "/comunidade", icon: "/icons/users.svg" },
  { id: "call", label: "CRAZZY CALL", href: "/call", icon: "/icons/headset.svg" },
  { id: "help", label: "Ajuda", href: "/help", icon: "/icons/book.svg" },
  { id: "support", label: "Suporte", href: "/tickets", icon: "/icons/headset.svg" },
  { id: "cart", label: "Carrinho", href: "/carrinho", icon: "/icons/shopping-cart.svg" },
];

export const adminNavigation: ShellNavItem[] = [
  { id: "admin", label: "Control", href: "/admin#inicio", icon: "/icons/home.svg" },
  { id: "products", label: "Produtos", href: "/admin/produtos", icon: "/icons/shopping-bag.svg" },
  { id: "categories", label: "Categorias", href: "/admin/categorias", icon: "/icons/neon-v2/gamepad.svg" },
  { id: "sales", label: "Vendas", href: "/admin/vendas", icon: "/icons/shopping-cart.svg" },
  { id: "payments", label: "Pagamentos", href: "/admin/pagamentos", icon: "/icons/credit-card.svg" },
  { id: "finance", label: "Financeiro", href: "/admin/finance", icon: "/icons/bolt.svg" },
  { id: "fulfillment", label: "Entregas", href: "/admin#fulfillment", icon: "/icons/package.svg" },
  { id: "discord", label: "Discord", href: "/admin/discord", icon: "/icons/users.svg" },
  { id: "campaigns", label: "Campanhas", href: "/admin/campanhas", icon: "/icons/flame.svg" },
  { id: "calls", label: "CRAZZY CALL", href: "/admin/calls", icon: "/icons/headset.svg" },
  { id: "stock", label: "Estoque", href: "/admin/estoque", icon: "/icons/package.svg" },
  { id: "academy", label: "Tutoriais", href: "/admin#tutorial", icon: "/icons/book.svg" },
  { id: "alerts", label: "Alertas", href: "/admin#alertas", icon: "/icons/flame.svg" },
];

export function getNavigation(mode: ShellMode): ShellNavItem[] {
  if (mode === "client") return clientNavigation;
  if (mode === "admin") return adminNavigation;
  return visitorNavigation;
}
