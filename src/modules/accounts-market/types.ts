export type AccountsMarketGame = "valorant" | "lol" | "fortnite" | "minecraft";

export type AccountsMarketItem = {
  id: string;
  title: string;
  game: AccountsMarketGame | "unknown";
  providerPrice: number | null;
  providerCurrency: string | null;
  region: string | null;
  rank: string | null;
  rankValue: number | null;
  level: number | null;
  skinsCount: number | null;
  knivesCount: number | null;
  agentsCount: number | null;
  inventoryValue: number | null;
  vp: number | null;
  rp: number | null;
  emailType: string | null;
  country: string | null;
  imageUrl: string | null;
};

export type AccountsMarketPageData = {
  items: AccountsMarketItem[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  source: "lzt";
  commercialPriceReady: false;
};

export type AccountsMarketFilters = {
  query: string;
  page: number;
  orderBy: "price_to_up" | "price_to_down" | "pdate_to_down";
  rankMin: string;
  rankMax: string;
  levelMin: string;
  levelMax: string;
  skinsMin: string;
  knivesMin: string;
  region: string;
};
