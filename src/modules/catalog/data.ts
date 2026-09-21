export type CatalogCategory =
  | "accounts"
  | "software"
  | "premium"
  | "streaming"
  | "tools"
  | "services";

export type CatalogBadge = "NOVO" | "MAIS VENDIDO" | "PROMO" | "PREMIUM";

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  category: CatalogCategory;
  image?: string;
  icon?: "gamepad" | "gear" | "crown" | "book" | "ai" | "customization";
  badges?: CatalogBadge[];
  stock: "available" | "limited" | "out";
  stockLabel: string;
  popularity: number;
  createdOrder: number;
  featured?: boolean;
  promo?: boolean;
};

export const catalogCategories = [
  { id: "all", label: "Todos", icon: "/icons/neon-v2/cube.svg" },
  { id: "accounts", label: "Contas", icon: "/icons/neon-v2/gamepad.svg" },
  { id: "software", label: "Software Gamer", icon: "/icons/neon-v2/gear.svg" },
  { id: "premium", label: "Produtos Premium", icon: "/icons/neon-v2/crown.svg" },
  { id: "streaming", label: "Streaming", icon: "/icons/neon-v2/book.svg" },
  { id: "tools", label: "Ferramentas", icon: "/icons/neon-v2/ai.svg" },
  { id: "services", label: "Serviços", icon: "/icons/neon-v2/customization.svg" },
] as const;

export const catalogProducts: CatalogProduct[] = [
  {
    id: "gta-v-premium",
    slug: "gta-v-premium",
    name: "GTA V Premium",
    subtitle: "Conta premium selecionada",
    category: "accounts",
    image: "/products/gta.jpg",
    badges: ["MAIS VENDIDO"],
    stock: "available",
    stockLabel: "Disponível",
    popularity: 100,
    createdOrder: 6,
    featured: true,
  },
  {
    id: "valorant-premium",
    slug: "valorant-premium",
    name: "VALORANT",
    subtitle: "Categoria premium Valorant",
    category: "accounts",
    image: "/products/valorant.jpg",
    badges: ["NOVO"],
    stock: "limited",
    stockLabel: "Estoque limitado",
    popularity: 92,
    createdOrder: 12,
    featured: true,
  },
  {
    id: "cod-premium",
    slug: "call-of-duty-premium",
    name: "Call of Duty",
    subtitle: "Conta premium selecionada",
    category: "accounts",
    image: "/products/cod.jpg",
    stock: "available",
    stockLabel: "Disponível",
    popularity: 88,
    createdOrder: 5,
  },
  {
    id: "rdr2-premium",
    slug: "rdr2-premium",
    name: "Red Dead Redemption 2",
    subtitle: "Conta premium selecionada",
    category: "accounts",
    image: "/products/rdr2.jpg",
    badges: ["PREMIUM"],
    stock: "available",
    stockLabel: "Disponível",
    popularity: 83,
    createdOrder: 4,
  },
  {
    id: "fortnite-premium",
    slug: "fortnite-premium",
    name: "Fortnite",
    subtitle: "Conta premium selecionada",
    category: "accounts",
    image: "/products/fortnite.jpg",
    badges: ["NOVO"],
    stock: "available",
    stockLabel: "Disponível",
    popularity: 80,
    createdOrder: 11,
  },
  {
    id: "gaming-utilities",
    slug: "gaming-utilities",
    name: "Gaming Utilities",
    subtitle: "Pacote de utilidades para PC",
    category: "software",
    icon: "gear",
    badges: ["MAIS VENDIDO"],
    stock: "available",
    stockLabel: "Disponível",
    popularity: 95,
    createdOrder: 8,
    featured: true,
  },
  {
    id: "performance-suite",
    slug: "performance-suite",
    name: "Performance Suite",
    subtitle: "Ferramentas para otimização e organização",
    category: "software",
    icon: "gear",
    stock: "available",
    stockLabel: "Disponível",
    popularity: 72,
    createdOrder: 3,
  },
  {
    id: "creator-studio",
    slug: "creator-studio",
    name: "Creator Studio",
    subtitle: "Pacote visual para criação e edição",
    category: "streaming",
    icon: "book",
    badges: ["NOVO", "PROMO"],
    stock: "available",
    stockLabel: "Disponível",
    popularity: 78,
    createdOrder: 13,
    promo: true,
  },
  {
    id: "stream-pack",
    slug: "stream-pack",
    name: "Stream Pack",
    subtitle: "Recursos para transmissão e identidade visual",
    category: "streaming",
    icon: "book",
    stock: "limited",
    stockLabel: "Poucas unidades",
    popularity: 69,
    createdOrder: 7,
  },
  {
    id: "ai-toolkit",
    slug: "ai-toolkit",
    name: "AI Toolkit",
    subtitle: "Ferramentas de IA para fluxos criativos",
    category: "tools",
    icon: "ai",
    badges: ["NOVO"],
    stock: "available",
    stockLabel: "Disponível",
    popularity: 90,
    createdOrder: 14,
    featured: true,
  },
  {
    id: "premium-bundle",
    slug: "premium-bundle",
    name: "CRAZZY Premium Bundle",
    subtitle: "Seleção especial de produtos premium",
    category: "premium",
    icon: "crown",
    badges: ["PREMIUM", "PROMO"],
    stock: "limited",
    stockLabel: "Estoque limitado",
    popularity: 97,
    createdOrder: 10,
    promo: true,
    featured: true,
  },
  {
    id: "setup-service",
    slug: "setup-service",
    name: "Setup Personalizado",
    subtitle: "Serviço de configuração sob medida",
    category: "services",
    icon: "customization",
    badges: ["PREMIUM"],
    stock: "available",
    stockLabel: "Agenda aberta",
    popularity: 74,
    createdOrder: 2,
  },
  {
    id: "discord-service",
    slug: "discord-service",
    name: "Discord Experience",
    subtitle: "Serviço visual e organização para comunidade",
    category: "services",
    icon: "customization",
    stock: "limited",
    stockLabel: "Vagas limitadas",
    popularity: 67,
    createdOrder: 1,
  },
  {
    id: "legacy-pack",
    slug: "legacy-pack",
    name: "Legacy Pack",
    subtitle: "Produto temporariamente indisponível",
    category: "premium",
    icon: "crown",
    stock: "out",
    stockLabel: "Indisponível",
    popularity: 40,
    createdOrder: 0,
  },
];

export const catalogSortOptions = [
  { id: "featured", label: "Destaques" },
  { id: "popular", label: "Mais vendidos" },
  { id: "newest", label: "Mais recentes" },
  { id: "name", label: "Nome A–Z" },
] as const;

export type CatalogSort = (typeof catalogSortOptions)[number]["id"];
