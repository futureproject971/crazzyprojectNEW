import type {
  AccountCosmetic,
  AccountsMarketGame,
  AccountsMarketItem,
  AccountsMarketPageData,
} from "./types";

type AnyRecord = Record<string, unknown>;

const valorantRanks: Record<number, string> = {
  3: "Ferro 1", 4: "Ferro 2", 5: "Ferro 3",
  6: "Bronze 1", 7: "Bronze 2", 8: "Bronze 3",
  9: "Prata 1", 10: "Prata 2", 11: "Prata 3",
  12: "Ouro 1", 13: "Ouro 2", 14: "Ouro 3",
  15: "Platina 1", 16: "Platina 2", 17: "Platina 3",
  18: "Diamante 1", 19: "Diamante 2", 20: "Diamante 3",
  21: "Ascendente 1", 22: "Ascendente 2", 23: "Ascendente 3",
  24: "Imortal 1", 25: "Imortal 2", 26: "Imortal 3",
  27: "Radiante",
};

const gameArt: Record<AccountsMarketGame, string> = {
  valorant: "/products/valorant.jpg",
  lol: "/products/valorant.jpg",
  fortnite: "/products/fortnite.jpg",
  minecraft: "/products/gta.jpg",
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
  if (value === 1 || value === "1" || value === "true" || value === "yes") return true;
  if (value === 0 || value === "0" || value === "false" || value === "no") return false;
  return null;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(toStringValue).filter((item): item is string => Boolean(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value as AnyRecord)
      .map(toStringValue)
      .filter((item): item is string => Boolean(item));
  }
  return [];
}

function detectGame(
  source: AnyRecord,
  fallback?: AccountsMarketGame
): AccountsMarketGame | "unknown" {
  if (fallback) return fallback;
  const game = String(firstValue(source, ["game", "category"]) ?? "").toLowerCase();
  if (game.includes("valorant") || game === "riot") return "valorant";
  if (game === "lol" || game.includes("league")) return "lol";
  if (game.includes("fortnite")) return "fortnite";
  if (game.includes("minecraft")) return "minecraft";
  return "unknown";
}

function normalizeCosmetics(value: unknown): AccountCosmetic[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const source = asRecord(entry);
      return {
        name: toStringValue(firstValue(source, ["name", "title"])) ?? "Item",
        category: toStringValue(firstValue(source, ["category", "type"])),
        rarity: toStringValue(firstValue(source, ["rarity", "tier"])),
        imagePath: toStringValue(firstValue(source, ["imagePath", "image_path"])),
      } satisfies AccountCosmetic;
    })
    .slice(0, 48);
}

export function normalizeAccountItem(
  input: unknown,
  fallbackGame?: AccountsMarketGame
): AccountsMarketItem {
  const source = asRecord(input);
  const id = toStringValue(firstValue(source, ["id", "item_id", "itemId"])) ?? "unknown";
  const game = detectGame(source, fallbackGame);

  const rankValue = toNumberValue(firstValue(source, [
    "rankValue", "rank_value", "riot_valorant_rank", "valorant_rank", "rank",
  ]));

  let rank = toStringValue(firstValue(source, [
    "rank", "rank_name", "valorant_rank_name", "riot_lol_rank", "lol_rank",
  ]));
  if (game === "valorant" && rankValue != null) {
    rank = valorantRanks[Math.round(rankValue)] ?? rank;
  }

  const safeGame = game === "unknown" ? (fallbackGame ?? "valorant") : game;
  const localImage = toStringValue(firstValue(source, ["imageUrl", "image_url"]));

  return {
    id,
    title: toStringValue(firstValue(source, ["title", "account_title", "name"])) ?? "Conta #" + id,
    game,
    price: toNumberValue(firstValue(source, ["price", "commercialPrice", "commercial_price"])),
    region: toStringValue(firstValue(source, [
      "region", "riot_valorant_region", "valorantRegionPhrase", "riot_lol_region", "lol_region",
    ])),
    rank,
    rankValue,
    level: toNumberValue(firstValue(source, [
      "level", "riot_valorant_level", "riot_lol_level", "fortnite_level", "minecraft_hypixel_level",
    ])),
    skinsCount: toNumberValue(firstValue(source, [
      "skinsCount", "skins_count", "riot_valorant_skin_count", "riot_lol_skin_count", "fortnite_skin_count",
    ])),
    knivesCount: toNumberValue(firstValue(source, [
      "knivesCount", "knives_count", "riot_valorant_knife_count", "riot_valorant_knife",
    ])),
    agentsCount: toNumberValue(firstValue(source, [
      "agentsCount", "agents_count", "riot_valorant_agent_count",
    ])),
    championsCount: toNumberValue(firstValue(source, [
      "championsCount", "champions_count", "riot_lol_champion_count",
    ])),
    inventoryValue: toNumberValue(firstValue(source, [
      "inventoryValue", "inventory_value", "riot_valorant_inventory_value",
    ])),
    vp: toNumberValue(firstValue(source, ["vp", "riot_valorant_wallet_vp"])),
    rp: toNumberValue(firstValue(source, ["rp", "riot_valorant_wallet_rp"])),
    emailType: toStringValue(firstValue(source, ["emailType", "email_type"])),
    country: toStringValue(firstValue(source, ["country", "riot_country"])),
    vbucks: toNumberValue(firstValue(source, ["vbucks", "fortnite_vbucks"])),
    minecoins: toNumberValue(firstValue(source, ["minecoins", "minecraft_minecoins"])),
    capesCount: toNumberValue(firstValue(source, ["capesCount", "capes_count", "minecraft_capes_count"])),
    java: toBooleanValue(firstValue(source, ["java", "minecraft_java"])),
    bedrock: toBooleanValue(firstValue(source, ["bedrock", "minecraft_bedrock"])),
    dungeons: toBooleanValue(firstValue(source, ["dungeons", "minecraft_dungeons"])),
    legends: toBooleanValue(firstValue(source, ["legends", "minecraft_legends"])),
    imageUrl: localImage?.startsWith("/") ? localImage : gameArt[safeGame],
    cosmetics: normalizeCosmetics(source.cosmetics),
    skinIds: toStringArray(firstValue(source, ["skinIds", "skin_ids"])),
    agentIds: toStringArray(firstValue(source, ["agentIds", "agent_ids"])),
    buddyIds: toStringArray(firstValue(source, ["buddyIds", "buddy_ids"])),
  };
}

export function normalizeAccountPage(
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
      .map((item) => normalizeAccountItem(item, game))
      .filter((item) => item.id !== "unknown" && item.id !== ""),
    currentPage,
    totalPages: Math.max(currentPage, totalPages),
    totalItems,
    hasNextPage:
      typeof source.hasNextPage === "boolean"
        ? source.hasNextPage
        : currentPage < totalPages,
    game,
  };
}
