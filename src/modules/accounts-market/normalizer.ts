import type {
  AccountsMarketGame,
  AccountsMarketItem,
  AccountsMarketPageData,
} from "./types";

type AnyRecord = Record<string, unknown>;

const valorantRanks: Record<number, string> = {
  3: "Iron 1",
  4: "Iron 2",
  5: "Iron 3",
  6: "Bronze 1",
  7: "Bronze 2",
  8: "Bronze 3",
  9: "Silver 1",
  10: "Silver 2",
  11: "Silver 3",
  12: "Gold 1",
  13: "Gold 2",
  14: "Gold 3",
  15: "Platinum 1",
  16: "Platinum 2",
  17: "Platinum 3",
  18: "Diamond 1",
  19: "Diamond 2",
  20: "Diamond 3",
  21: "Ascendant 1",
  22: "Ascendant 2",
  23: "Ascendant 3",
  24: "Immortal 1",
  25: "Immortal 2",
  26: "Immortal 3",
  27: "Radiant",
};

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};
}

function readPath(source: AnyRecord, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = source;

  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as AnyRecord)[part];
  }

  return current;
}

function firstValue(source: AnyRecord, paths: string[]): unknown {
  for (const path of paths) {
    const value = readPath(source, path);
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
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function countValue(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value as object).length;
  return toNumberValue(value);
}

function detectGame(source: AnyRecord): AccountsMarketGame | "unknown" {
  const game = String(
    firstValue(source, [
      "game",
      "riot_game",
      "category",
      "category_name",
      "riot.game",
      "account.game",
    ]) ?? ""
  ).toLowerCase();

  if (game.includes("valorant")) return "valorant";
  if (game.includes("league") || game === "lol") return "lol";
  if (game.includes("fortnite")) return "fortnite";
  if (game.includes("minecraft")) return "minecraft";

  const title = String(source.title ?? "").toLowerCase();
  if (title.includes("valorant")) return "valorant";
  if (title.includes("league of legends") || title.includes(" lol ")) return "lol";
  if (title.includes("fortnite")) return "fortnite";
  if (title.includes("minecraft")) return "minecraft";

  return "unknown";
}

export function normalizeLztItem(input: unknown): AccountsMarketItem {
  const source = asRecord(input);

  const id =
    toStringValue(firstValue(source, ["item_id", "itemId", "id"])) ??
    "unknown";

  const rankValue = toNumberValue(
    firstValue(source, [
      "valorant_rank",
      "riotRank",
      "rank",
      "valorant.rank",
      "riot.rank",
    ])
  );

  const rankText =
    toStringValue(
      firstValue(source, [
        "valorant_rank_name",
        "rank_name",
        "rankName",
        "valorant.rank_name",
      ])
    ) ?? (rankValue != null ? valorantRanks[Math.round(rankValue)] ?? null : null);

  return {
    id,
    title:
      toStringValue(firstValue(source, ["title", "account_title", "name"])) ??
      `Conta #${id}`,
    game: detectGame(source),
    providerPrice: toNumberValue(firstValue(source, ["price", "cost", "item_price"])),
    providerCurrency: toStringValue(firstValue(source, ["currency", "price_currency"])),
    region: toStringValue(
      firstValue(source, [
        "valorant_region",
        "region",
        "riot_region",
        "valorant.region",
        "riot.region",
      ])
    ),
    rank: rankText,
    rankValue,
    level: toNumberValue(
      firstValue(source, [
        "valorant_level",
        "level",
        "valorant.level",
        "riot.valorant_level",
      ])
    ),
    skinsCount: countValue(
      firstValue(source, [
        "valorant_skins",
        "weaponSkins",
        "weapon_skins",
        "skins",
        "skin_count",
        "skins_count",
      ])
    ),
    knivesCount: countValue(
      firstValue(source, [
        "valorant_knives",
        "knives",
        "knife_count",
        "valorant_knife_count",
      ])
    ),
    agentsCount: countValue(
      firstValue(source, ["agents", "valorant_agents", "agent_count", "agents_count"])
    ),
    inventoryValue: toNumberValue(
      firstValue(source, ["inventory_value", "inv", "inventoryValue"])
    ),
    vp: toNumberValue(firstValue(source, ["vp", "valorant_points", "valorant_vp"])),
    rp: toNumberValue(firstValue(source, ["rp", "radiant_points", "valorant_rp"])),
    emailType: toStringValue(firstValue(source, ["email_type", "emailType"])),
    country: toStringValue(firstValue(source, ["country", "country_name"])),
    imageUrl: toStringValue(
      firstValue(source, ["image_url", "image", "thumbnail", "preview_url"])
    ),
  };
}

export function normalizeLztPage(input: unknown): AccountsMarketPageData {
  const source = asRecord(input);
  const rawItems = Array.isArray(source.items)
    ? source.items
    : source.items && typeof source.items === "object"
      ? Object.values(source.items as AnyRecord)
      : [];

  const currentPage =
    toNumberValue(firstValue(source, ["currentPage", "current_page", "page"])) ?? 1;
  const totalPages =
    toNumberValue(firstValue(source, ["totalPages", "total_pages"])) ?? currentPage;
  const totalItems =
    toNumberValue(firstValue(source, ["totalItems", "total_items", "total"])) ??
    rawItems.length;

  return {
    items: rawItems.map(normalizeLztItem).filter((item) => item.id !== "unknown"),
    currentPage,
    totalPages: Math.max(currentPage, totalPages),
    totalItems,
    hasNextPage:
      typeof source.hasNextPage === "boolean"
        ? source.hasNextPage
        : currentPage < totalPages,
    source: "lzt",
    commercialPriceReady: false,
  };
}
