export type AccountsMarketGame = "valorant" | "lol" | "fortnite" | "minecraft";

export type AccountCosmetic = {
  name: string;
  category: string | null;
  rarity: string | null;
  imagePath: string | null;
};

export type AccountsMarketItem = {
  id: string;
  title: string;
  game: AccountsMarketGame | "unknown";
  price: number | null;
  region: string | null;
  rank: string | null;
  rankValue: number | null;
  level: number | null;
  skinsCount: number | null;
  knivesCount: number | null;
  agentsCount: number | null;
  championsCount: number | null;
  inventoryValue: number | null;
  vp: number | null;
  rp: number | null;
  emailType: string | null;
  country: string | null;
  vbucks: number | null;
  minecoins: number | null;
  capesCount: number | null;
  java: boolean | null;
  bedrock: boolean | null;
  dungeons: boolean | null;
  legends: boolean | null;
  imageUrl: string | null;
  cosmetics: AccountCosmetic[];
  skinIds: string[];
};

export type AccountsMarketPageData = {
  items: AccountsMarketItem[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  game: AccountsMarketGame;
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
  championsMin: string;
  vbucksMin: string;
  platform: string;
  capesMin: string;
  minecoinsMin: string;
  hypixelLevelMin: string;
  javaEdition: string;
  bedrockEdition: string;
  weapon: string;
  onlyKnife: string;
  priceMin: string;
  priceMax: string;
  inventoryMin: string;
  inventoryMax: string;
};
