import { catalogProducts, type CatalogProduct } from "@/modules/catalog";

export type ProductPlan = {
  id: string;
  name: string;
  duration: string;
  note: string;
  priceLabel: string;
  featured?: boolean;
};

export type ProductReview = {
  id: string;
  name: string;
  rating: number;
  time: string;
  text: string;
  verified?: boolean;
};

export type ProductGalleryItem = {
  id: string;
  label: string;
  image?: string;
  icon?: "gamepad" | "gear" | "crown" | "book" | "ai" | "customization" | "cube" | "shield";
  position?: string;
};

export type ProductDetail = {
  product: CatalogProduct;
  eyebrow: string;
  description: string;
  longDescription: string;
  gallery: ProductGalleryItem[];
  plans: ProductPlan[];
  benefits: Array<{ title: string; text: string; icon: "shield" | "lightning" | "verified" | "community" | "crown" }>;
  compatibility: string[];
  requirements: string[];
  highlights: string[];
  reviews: ProductReview[];
  rating: number;
  ratingCount: number;
  faq: Array<{ question: string; answer: string }>;
};

const reviews: ProductReview[] = [
  {
    id: "r1",
    name: "Shadow77",
    rating: 5,
    time: "há 2 dias",
    text: "Experiência bem organizada, entrega rápida e painel fácil de entender.",
    verified: true,
  },
  {
    id: "r2",
    name: "Miyuki",
    rating: 5,
    time: "há 5 dias",
    text: "Curti bastante a apresentação e o suporte. Voltaria a comprar.",
    verified: true,
  },
  {
    id: "r3",
    name: "Zer0x",
    rating: 4,
    time: "há 1 semana",
    text: "Tudo certo no meu pedido. Interface simples e informação direta.",
    verified: true,
  },
];

function categoryCopy(product: CatalogProduct) {
  if (product.category === "accounts") {
    return {
      eyebrow: "CONTAS & JOGOS",
      description: "Produto digital apresentado com status, planos e informações organizadas em uma única tela.",
      longDescription:
        "Esta página demonstra a experiência de produto da CRAZZY PROJECT. Os dados comerciais continuam mockados nesta fase e serão conectados aos módulos de carrinho, checkout e backend posteriormente.",
      compatibility: ["PC", "Entrega digital", "Conta / acesso conforme anúncio"],
      requirements: ["E-mail válido", "Acesso ao painel do cliente após a integração de autenticação", "Ler as observações do plano antes da compra"],
      highlights: ["Entrega digital", "Status visível", "Suporte centralizado", "Planos organizados"],
    };
  }

  if (product.category === "streaming") {
    return {
      eyebrow: "STREAMING & CRIAÇÃO",
      description: "Pacote digital com foco em criação, identidade visual e fluxo de trabalho.",
      longDescription:
        "A apresentação mostra como os pacotes de criação e streaming poderão ser descritos, comparados e selecionados antes do checkout real.",
      compatibility: ["PC", "Fluxos de criação", "Arquivos digitais"],
      requirements: ["Aplicativo compatível conforme o produto final", "Espaço local para arquivos", "Conta CRAZZY para biblioteca futura"],
      highlights: ["Recursos digitais", "Organização por pacote", "Download futuro pela biblioteca", "Suporte"],
    };
  }

  if (product.category === "services") {
    return {
      eyebrow: "SERVIÇOS CRAZZY",
      description: "Serviço personalizado com disponibilidade e escopo apresentados de forma transparente.",
      longDescription:
        "Esta tela reserva espaço para briefing, disponibilidade, contratação e acompanhamento. O agendamento real será conectado em uma etapa posterior.",
      compatibility: ["Atendimento online", "Briefing digital", "Entrega combinada"],
      requirements: ["Enviar briefing", "Confirmar disponibilidade", "Aguardar definição do escopo"],
      highlights: ["Atendimento humano", "Escopo organizado", "Status de agenda", "Acompanhamento"],
    };
  }

  return {
    eyebrow: product.category === "tools" ? "FERRAMENTAS & IA" : product.category === "premium" ? "CRAZZY PREMIUM" : "SOFTWARE GAMER",
    description: "Produto digital organizado por planos, compatibilidade, benefícios e suporte.",
    longDescription:
      "A página individual concentra todas as informações necessárias para comparação antes da compra. Valores e integrações comerciais reais permanecem fora do M05.",
    compatibility: ["Windows 10 / 11", "PC 64-bit", "Entrega digital"],
    requirements: ["Sistema atualizado", "Conexão com internet", "Conta CRAZZY para recursos futuros"],
    highlights: ["Instalação guiada", "Status do produto", "Planos flexíveis", "Suporte centralizado"],
  };
}

function defaultPlans(product: CatalogProduct): ProductPlan[] {
  if (product.category === "services") {
    return [
      { id: "basic", name: "Base", duration: "Escopo inicial", note: "Para demandas objetivas e de menor complexidade.", priceLabel: "Consultar" },
      { id: "plus", name: "Plus", duration: "Escopo ampliado", note: "Mais etapas e personalização.", priceLabel: "Consultar", featured: true },
      { id: "custom", name: "Custom", duration: "Sob medida", note: "Briefing e orçamento personalizados.", priceLabel: "Consultar" },
    ];
  }

  if (product.category === "accounts") {
    return [
      { id: "standard", name: "Standard", duration: "Entrega única", note: "Opção de entrada para este produto.", priceLabel: "Consultar" },
      { id: "premium", name: "Premium", duration: "Entrega única", note: "Versão destacada conforme disponibilidade.", priceLabel: "Consultar", featured: true },
      { id: "bundle", name: "Bundle", duration: "Pacote", note: "Combinação de benefícios quando disponível.", priceLabel: "Consultar" },
    ];
  }

  return [
    { id: "daily", name: "24 Horas", duration: "1 dia", note: "Ideal para testar a experiência.", priceLabel: "Consultar" },
    { id: "weekly", name: "7 Dias", duration: "1 semana", note: "Equilíbrio entre tempo e flexibilidade.", priceLabel: "Consultar", featured: true },
    { id: "monthly", name: "30 Dias", duration: "1 mês", note: "Maior período de acesso.", priceLabel: "Consultar" },
  ];
}

function galleryFor(product: CatalogProduct): ProductGalleryItem[] {
  if (product.image) {
    return [
      { id: "main", label: "Visão geral", image: product.image, position: "center" },
      { id: "detail", label: "Detalhe", image: product.image, position: "35% center" },
      { id: "preview", label: "Preview", image: product.image, position: "70% center" },
      { id: "info", label: "Informações", icon: product.icon ?? "cube" },
    ];
  }

  return [
    { id: "main", label: "Visão geral", icon: product.icon ?? "cube" },
    { id: "features", label: "Recursos", icon: product.icon ?? "cube" },
    { id: "support", label: "Suporte", icon: "shield" },
    { id: "premium", label: "CRAZZY", icon: "crown" },
  ];
}

export function getProductDetail(slug: string): ProductDetail | undefined {
  const product = catalogProducts.find((item) => item.slug === slug);
  if (!product) return undefined;

  const copy = categoryCopy(product);

  return {
    product,
    eyebrow: copy.eyebrow,
    description: copy.description,
    longDescription: copy.longDescription,
    gallery: galleryFor(product),
    plans: defaultPlans(product),
    benefits: [
      { title: "Compra protegida", text: "Fluxo visual preparado para checkout seguro.", icon: "shield" },
      { title: "Entrega rápida", text: "Estrutura pronta para entrega digital automatizada.", icon: "lightning" },
      { title: "Cliente verificado", text: "Pedidos e histórico ficarão ligados ao Client Hub.", icon: "verified" },
      { title: "Suporte CRAZZY", text: "Ticket e comunidade integrados à experiência.", icon: "community" },
    ],
    compatibility: copy.compatibility,
    requirements: copy.requirements,
    highlights: copy.highlights,
    reviews,
    rating: 4.8,
    ratingCount: 127,
    faq: [
      {
        question: "Como recebo o produto?",
        answer: "Nesta fase a entrega é apenas demonstrativa. O fluxo real será conectado aos módulos de carrinho, checkout e biblioteca.",
      },
      {
        question: "Os valores já são reais?",
        answer: "Não. O M05 preserva os valores como “Consultar” para não inventar preços antes da integração comercial.",
      },
      {
        question: "O status de estoque é definitivo?",
        answer: "Ainda não. O status exibido vem de mock data até o backend ser conectado.",
      },
    ],
  };
}

export function getRelatedProducts(product: CatalogProduct) {
  const sameCategory = catalogProducts.filter(
    (item) => item.id !== product.id && item.category === product.category
  );
  const fallback = catalogProducts.filter(
    (item) => item.id !== product.id && item.category !== product.category
  );

  return [...sameCategory, ...fallback].slice(0, 4);
}

export function getAllProductSlugs() {
  return catalogProducts.map((product) => product.slug);
}
