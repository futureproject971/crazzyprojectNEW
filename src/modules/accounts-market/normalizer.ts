import type {
  AccountsMarketGame,
  AccountsMarketItem,
  AccountsMarketPageData,
} from "./types";

type AnyRecord = Record<string, unknown>;

const valorantRanks: Record<number, string> = {
  3: "Iron 1", 4: "Iron 2", 5: "Iron 3",
  6: "Bronze 1", 7: "Bronze 2", 8: "Bronze 3",
  9: "Silver 1", 10: "Silver 2", 11: "Silver 3",
  12: "Gold 1", 13: "Gold 2", 14: "Gold 3",
  15: "Platinum 1", 16: "Platinum 2", 17: "Platinum 3",
  18: "Diamond 1", 19: "Diamond 2", 20: "Diamond 3",
  21: "Ascendant 1", 22: "Ascendant 2", 23: "Ascendant 3",
  24: "Immortal 1", 25: "Immortal 2", 26: "Immortal 3",
  27: "Radiant",
};

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};
}

function firstValue(source: AnyRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toBooleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

function detectGame(
  source: AnyRecord,
  fallback?: AccountsMarketGame
): AccountsMarketGame | "unknown" {
  if (fallback) return fallback;
  const game = String(firstValue(source, ["game", "category"]) ?? "").toLowerCase();
  if (game.includes("valorant")) return "valorant";
  if (game === "lol" || game.includes("league")) return "lol";
  if (game.includes("fortnite")) return "fortnite";
  if (game.includes("minecraft")) return "minecraft";
  return "unknown";
}

export function normalizeLztItem(
  input: unknown,
  fallbackGame?: AccountsMarketGame
): AccountsMarketItem {
  const source = asRecord(input);
  const id = toStringValue(firstValue(source, ["id", "item_id", "itemId"])) ?? "unknown";
  const game = detectGame(source, fallbackGame);
  const rankValue = toNumberValue(firstValue(source, ["rankValue", "valorant_rank", "rank"]));

  let rank = toStringValue(firstValue(source, ["rank", "rank_name", "valorant_rank_name"]));
  if (game === "valorant" && rankValue != null && (!rank || /^\d+$/.test(rank))) {
    rank = valorantRanks[Math.round(rankValue)] ?? rank;
  }

  return {
    id,
    title: toStringValue(firstValue(source, ["title", "account_title", "name"])) ?? "Conta #" + id,
    game,
    providerPrice: toNumberValue(firstValue(source, ["providerPrice", "price"])),
    providerCurrency: toStringValue(firstValue(source, ["providerCurrency", "currency"])),
    region: toStringValue(firstValue(source, ["region"])),
    rank,
    rankValue,
    level: toNumberValue(firstValue(source, ["level"])),
    skinsCount: toNumberValue(firstValue(source, ["skinsCount", "skins_count"])),
    knivesCount: toNumberValue(firstValue(source, ["knivesCount", "knives_count"])),
    agentsCount: toNumberValue(firstValue(source, ["agentsCount", "agents_count"])),
    championsCount: toNumberValue(firstValue(source, ["championsCount", "champions_count"])),
    inventoryValue: toNumberValue(firstValue(source, ["inventoryValue", "inventory_value"])),
    vp: toNumberValue(firstValue(source, ["vp"])),
    rp: toNumberValue(firstValue(source, ["rp"])),
    emailType: toStringValue(firstValue(source, ["emailType", "email_type"])),
    country: toStringValue(firstValue(source, ["country"])),
    vbucks: toNumberValue(firstValue(source, ["vbucks"])),
    minecoins: toNumberValue(firstValue(source, ["minecoins"])),
    capesCount: toNumberValue(firstValue(source, ["capesCount", "capes_count"])),
    java: toBooleanValue(firstValue(source, ["java"])),
    bedrock: toBooleanValue(firstValue(source, ["bedrock"])),
    dungeons: toBooleanValue(firstValue(source, ["dungeons"])),
    legends: toBooleanValue(firstValue(source, ["legends"])),
    imageUrl: null,
  };
}

export function normalizeLztPage(
  input: unknown,
  game: AccountsMarketGame
): AccountsMarketPageData {
  const source = asRecord(input);
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const currentPage = toNumberValue(source.currentPage) ?? 1;
  const totalPages = toNumberValue(source.totalPages) ?? currentPage;
  const totalItems = toNumberValue(source.totalItems) ?? rawItems.length;

  return {
    items: rawItems
      .map((item) => normalizeLztItem(item, game))
      .filter((item) => item.id !== "unknown" && item.id !== ""),
    currentPage,
    totalPages: Math.max(currentPage, totalPages),
    totalItems,
    hasNextPage:
      typeof source.hasNextPage === "boolean"
        ? source.hasNextPage
        : currentPage < totalPages,
    source: "lzt",
    game,
    credentialReady: true,
    commercialPriceReady: false,
  };
}
