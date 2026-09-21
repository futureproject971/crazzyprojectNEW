export type DiscoveryItem = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  badge?: string;
  image?: string;
  tone: "blue" | "cyan" | "violet" | "pink" | "gold";
  featured?: boolean;
};

export const discoveryCategories = [
  { id: "all", label: "Tudo", icon: "/icons/neon-v2/cube.svg" },
  { id: "games", label: "Jogos", icon: "/icons/neon-v2/gamepad.svg" },
  { id: "valorant", label: "Valorant", icon: "/icons/neon-v2/shield.svg" },
  { id: "software", label: "Softwares", icon: "/icons/neon-v2/gear.svg" },
  { id: "creation", label: "IA & Criação", icon: "/icons/neon-v2/ai.svg" },
  { id: "premium", label: "Premium", icon: "/icons/neon-v2/crown.svg" },
] as const;

export const discoveryItems: DiscoveryItem[] = [
  {
    id: "gta-premium",
    title: "GTA V Premium",
    subtitle: "Uma das seleções mais procuradas da comunidade.",
    category: "games",
    badge: "EM ALTA",
    image: "/products/gta.jpg",
    tone: "blue",
    featured: true,
  },
  {
    id: "valorant",
    title: "Valorant",
    subtitle: "Confira as novidades e produtos da categoria.",
    category: "valorant",
    badge: "NOVO",
    image: "/products/valorant.jpg",
    tone: "pink",
    featured: true,
  },
  {
    id: "cod",
    title: "Call of Duty",
    subtitle: "Conteúdo selecionado para quem curte FPS.",
    category: "games",
    image: "/products/cod.jpg",
    tone: "cyan",
    featured: true,
  },
  {
    id: "rdr2",
    title: "Red Dead Redemption 2",
    subtitle: "Explore uma das experiências mais queridas da loja.",
    category: "games",
    image: "/products/rdr2.jpg",
    tone: "gold",
  },
  {
    id: "fortnite",
    title: "Fortnite",
    subtitle: "Novidades da categoria e destaques recentes.",
    category: "games",
    image: "/products/fortnite.jpg",
    tone: "violet",
  },
  {
    id: "software-tools",
    title: "Softwares & Ferramentas",
    subtitle: "Utilidades selecionadas para PC e produtividade.",
    category: "software",
    badge: "DESTAQUE",
    tone: "blue",
  },
  {
    id: "ai-creation",
    title: "IA & Criação",
    subtitle: "Ferramentas para criação, edição e streaming.",
    category: "creation",
    badge: "NOVO",
    tone: "violet",
  },
  {
    id: "premium-zone",
    title: "CRAZZY Premium",
    subtitle: "Uma vitrine especial para produtos e experiências premium.",
    category: "premium",
    tone: "gold",
  },
];

export const discoveryNews = [
  {
    id: "community",
    date: "HOJE",
    title: "Comunidade CRAZZY crescendo",
    text: "Novos espaços, recursos e experiências estão chegando à plataforma.",
  },
  {
    id: "store",
    date: "NOVIDADE",
    title: "Vitrine reformulada",
    text: "Categorias e destaques agora ganham uma experiência visual mais direta.",
  },
  {
    id: "rewards",
    date: "EM BREVE",
    title: "CRAZZY Rewards",
    text: "Missões, recompensas e benefícios terão uma área dedicada.",
  },
];
