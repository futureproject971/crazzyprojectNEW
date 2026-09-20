export type FeedbackItem = {
  id: number;
  name: string;
  verified?: boolean;
  time: string;
  message: string;
  reactions: { heart: number; fire: number; comments: number };
};

export type ChatMessage = {
  id: number;
  name: string;
  time: string;
  message: string;
  tone: "blue" | "pink" | "orange" | "violet" | "cyan";
};

export const feedbacks: FeedbackItem[] = [
  {
    id: 1,
    name: "joaovfps",
    verified: true,
    time: "há 3h",
    message: "Conta do GTA V chegou certinho, tudo funcionando! Atendimento rápido e suporte nota 10. 🔥",
    reactions: { heart: 35, fire: 5, comments: 0 },
  },
  {
    id: 2,
    name: "mariigss",
    verified: true,
    time: "há 6h",
    message: "Windows 11 Pro ativado em minutos, tudo certo! Recomendo demais a CRAZZY! 💙",
    reactions: { heart: 28, fire: 4, comments: 0 },
  },
  {
    id: 3,
    name: "rdgamerx",
    verified: true,
    time: "há 1d",
    message: "Comprei um produto FC 24, chegou na hora. Suporte me ajudou em tudo, loja confiável! 🔥",
    reactions: { heart: 41, fire: 2, comments: 2 },
  },
  {
    id: 4,
    name: "lunazinhaa",
    verified: true,
    time: "há 1d",
    message: "Já é a terceira compra aqui, sempre perfeito! Melhor loja de games do Brasil. 💜",
    reactions: { heart: 26, fire: 6, comments: 0 },
  },
];

export const chatMessages: ChatMessage[] = [
  { id: 1, name: "Shadow77", time: "hoje às 14:27", message: "Alguém jogando Valorant hoje? Bora formar um squad?", tone: "blue" },
  { id: 2, name: "Miyuki", time: "hoje às 14:28", message: "Tô esperando meu RDR2 chegar, ansioso demais! 🔥", tone: "pink" },
  { id: 3, name: "Lucasantj", time: "hoje às 14:29", message: "Essa loja é braba, comprei 3 jogos já, zero problemas. 👍", tone: "orange" },
  { id: 4, name: "Zer0x", time: "hoje às 14:30", message: "Alguém tem recomendação de um bom headset?", tone: "cyan" },
  { id: 5, name: "Akira", time: "hoje às 14:31", message: "Cyberpunk 2077 continua incrível... que jogo!", tone: "violet" },
  { id: 6, name: "Natsuki", time: "hoje às 14:32", message: "Alguém sabe se vai ter promoção de contas Steam hoje?", tone: "pink" },
  { id: 7, name: "FelipeS", time: "hoje às 14:33", message: "Suporte da CRAZZY é diferenciado, me atenderam super bem! 💙", tone: "blue" },
];

export const ticketCategories = [
  { title: "Suporte", subtitle: "Problemas e dúvidas", icon: "/icons/headset.svg" },
  { title: "Pedidos", subtitle: "Status e entregas", icon: "/icons/package.svg" },
  { title: "Pagamentos", subtitle: "Boletos, PIX, reembolsos", icon: "/icons/credit-card.svg" },
  { title: "Produtos", subtitle: "Informações e suporte", icon: "/icons/shopping-bag.svg" },
  { title: "Outros", subtitle: "Assuntos diversos", icon: "/icons/circle-dots.svg" },
];

export const whyCrazzy = [
  { title: "Atendimento 24/7", subtitle: "Suporte de verdade, todos os dias", icon: "/icons/headset.svg" },
  { title: "Entrega Super Rápida", subtitle: "Receba seus produtos no seu e-mail", icon: "/icons/bolt.svg" },
  { title: "Compra Segura", subtitle: "Ambiente 100% seguro e confiável", icon: "/icons/shield-check.svg" },
  { title: "Comunidade Ativa", subtitle: "+50.000 gamers já fazem parte", icon: "/icons/users.svg" },
  { title: "Cupons e Promoções", subtitle: "Ofertas exclusivas para membros", icon: "/icons/tag.svg" },
];


export type FeaturedProduct = {
  id: string;
  name: string;
  subtitle: string;
  badge?: string;
  art: "rdr2" | "cod" | "gta" | "valorant" | "fortnite";
};

export const featuredProducts: FeaturedProduct[] = [
  { id: "rdr2", name: "RDR2", subtitle: "Conta Premium", art: "rdr2" },
  { id: "cod", name: "Call of Duty", subtitle: "Conta Premium", art: "cod" },
  { id: "gta", name: "GTA V", subtitle: "Conta Premium", art: "gta", badge: "Mais Vendido" },
  { id: "valorant", name: "VALORANT", subtitle: "Conta Premium", art: "valorant" },
  { id: "fortnite", name: "Fortnite", subtitle: "Conta Premium", art: "fortnite" },
];

export type StoreCategory = {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  art: string;
  tone: "blue" | "violet" | "gold";
};

export const storeCategories: StoreCategory[] = [
  { id: "accounts", name: "Contas de Jogos", subtitle: "Steam, EA, Rockstar e mais", icon: "/icons/circle-dots.svg", art: "cars", tone: "blue" },
  { id: "software", name: "Softwares Gamer", subtitle: "Windows, Office e mais", icon: "/icons/package.svg", art: "setup", tone: "blue" },
  { id: "stream", name: "Utilitários pra Stream", subtitle: "Overlays, OBS, Plugins", icon: "/icons/message-circle.svg", art: "stream", tone: "violet" },
  { id: "premium", name: "Produtos Premium", subtitle: "Cards, Gift Cards e mais", icon: "/icons/crown.svg", art: "premium", tone: "gold" },
  { id: "launches", name: "Lançamentos", subtitle: "Jogos e contas recentes", icon: "/icons/bolt.svg", art: "launches", tone: "blue" },
  { id: "best", name: "Mais Vendidos", subtitle: "Os preferidos da galera", icon: "/icons/crown.svg", art: "best", tone: "gold" },
];
