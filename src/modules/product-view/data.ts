import { CRAZZY_STANDARD_PLANS, shouldShowPlanToCustomer, type StandardPlanCode } from "@/core/commerce/policy";
import { catalogProducts, type CatalogProduct } from "@/modules/catalog";

export type ProductPlanCode = StandardPlanCode | "single" | "custom";

export type ProductPlan = {
  id: string;
  code: ProductPlanCode;
  name: string;
  duration: string;
  note: string;
  price: number | null;
  priceLabel: string;
  featured?: boolean;
  stockCount?: number | null;
  showWhenOutOfStock?: boolean;
};

export const CRAZZY_STANDARD_PLAN_TEMPLATES = [
  { code: "1d" as const, name: "Diário", duration: "1 dia", note: "Acesso por 24 horas." },
  { code: "3d" as const, name: "3 Dias", duration: "3 dias", note: "Acesso por 3 dias." },
  { code: "7d" as const, name: "7 Dias", duration: "7 dias", note: "Acesso por 7 dias." },
  { code: "15d" as const, name: "15 Dias", duration: "15 dias", note: "Acesso por 15 dias." },
  { code: "30d" as const, name: "Mensal", duration: "30 dias", note: "Elegível ao Combo Mensal.", featured: true },
  { code: "90d" as const, name: "90 Dias", duration: "90 dias", note: "Acesso por 90 dias." },
  { code: "lifetime" as const, name: "Lifetime", duration: "Vitalício", note: "Elegível ao Combo Lifetime." },
];


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
  rating: number;
  ratingCount: number;
};


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

function planIsCustomerVisible(plan: ProductPlan) {
  return shouldShowPlanToCustomer(plan.stockCount, plan.showWhenOutOfStock);
}

function defaultPlans(product: CatalogProduct): ProductPlan[] {
  if (product.category === "services") {
    return [
      { id: "basic", code: "custom", name: "Base", duration: "Escopo inicial", note: "Para demandas objetivas e de menor complexidade.", price: null, priceLabel: "Consultar" },
      { id: "plus", code: "custom", name: "Plus", duration: "Escopo ampliado", note: "Mais etapas e personalização.", price: null, priceLabel: "Consultar", featured: true },
      { id: "custom", code: "custom", name: "Custom", duration: "Sob medida", note: "Briefing e orçamento personalizados.", price: null, priceLabel: "Consultar" },
    ];
  }

  if (product.category === "accounts") {
    return [
      { id: "single", code: "single", name: "Conta", duration: "Entrega única", note: "Conta individual conforme anúncio e disponibilidade.", price: null, priceLabel: "Consultar", featured: true },
    ];
  }

  return CRAZZY_STANDARD_PLANS.map((template) => ({
    id: product.id + "-" + template.code,
    code: template.code,
    name: template.name,
    duration: template.duration,
    note: template.note,
    price: null,
    priceLabel: "Consultar",
    featured: "featured" in template ? template.featured : false,
    // Quando o backend estiver conectado:
    // stockCount 0 = oculto por padrão;
    // showWhenOutOfStock true = exibe como esgotado;
    // stockCount > 0 = plano vendável.
    stockCount: null,
    showWhenOutOfStock: false,
  })).filter(planIsCustomerVisible);
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
    rating: 4.8,
    ratingCount: 127,
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
