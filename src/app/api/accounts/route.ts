import { NextRequest, NextResponse } from "next/server";
import { normalizeAccountPage } from "@/modules/accounts-market/normalizer";
import type { AccountsMarketGame } from "@/modules/accounts-market/types";

const DEFAULT_SUPABASE_URL = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const games = new Set<AccountsMarketGame>(["valorant", "lol", "fortnite", "minecraft"]);

function gameCategory(game: AccountsMarketGame) {
  if (game === "fortnite") return "fortnite";
  if (game === "minecraft") return "minecraft";
  return "riot";
}

function copyIfPresent(
  source: URLSearchParams,
  target: URLSearchParams,
  sourceKey: string,
  targetKey: string
) {
  const value = source.get(sourceKey);
  if (value != null && value.trim() !== "") target.set(targetKey, value.trim());
}

export async function GET(request: NextRequest) {
  const incoming = request.nextUrl.searchParams;
  const requestedGame = incoming.get("game") || "valorant";

  if (!games.has(requestedGame as AccountsMarketGame)) {
    return NextResponse.json({ error: "Jogo inválido." }, { status: 400 });
  }

  const game = requestedGame as AccountsMarketGame;
  const params = new URLSearchParams();
  params.set("action", "preview-v2");
  params.set("category", gameCategory(game));
  params.set("game", game);

  copyIfPresent(incoming, params, "page", "page");
  copyIfPresent(incoming, params, "query", "title");
  copyIfPresent(incoming, params, "orderBy", "order_by");

  if (game === "valorant") {
    copyIfPresent(incoming, params, "rankMin", "rmin");
    copyIfPresent(incoming, params, "rankMax", "rmax");
    copyIfPresent(incoming, params, "levelMin", "valorant_level_min");
    copyIfPresent(incoming, params, "levelMax", "valorant_level_max");
    copyIfPresent(incoming, params, "skinsMin", "valorant_smin");
    copyIfPresent(incoming, params, "knivesMin", "valorant_knife_min");
    const region = incoming.get("region");
    if (region?.trim()) params.append("valorant_region[]", region.trim());
  }

  if (game === "lol") {
    copyIfPresent(incoming, params, "levelMin", "lol_level_min");
    copyIfPresent(incoming, params, "levelMax", "lol_level_max");
    copyIfPresent(incoming, params, "skinsMin", "lol_smin");
    copyIfPresent(incoming, params, "championsMin", "champion_min");
    const region = incoming.get("region");
    if (region?.trim()) params.append("lol_region[]", region.trim());
  }

  if (game === "fortnite") {
    copyIfPresent(incoming, params, "levelMin", "lmin");
    copyIfPresent(incoming, params, "levelMax", "lmax");
    copyIfPresent(incoming, params, "skinsMin", "smin");
    copyIfPresent(incoming, params, "vbucksMin", "vbmin");
    const platform = incoming.get("platform");
    if (platform?.trim()) params.append("platform[]", platform.trim());
  }

  if (game === "minecraft") {
    copyIfPresent(incoming, params, "hypixelLevelMin", "level_hypixel_min");
    copyIfPresent(incoming, params, "capesMin", "capes_min");
    copyIfPresent(incoming, params, "minecoinsMin", "minecoins_min");
    copyIfPresent(incoming, params, "javaEdition", "java");
    copyIfPresent(incoming, params, "bedrockEdition", "bedrock");
  }

  if (!params.has("page")) params.set("page", "1");
  if (!params.has("order_by")) params.set("order_by", "pdate_to_down");

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
  const edgeUrl = new URL("/functions/v1/lzt-market", baseUrl);
  edgeUrl.search = params.toString();

  try {
    const response = await fetch(edgeUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: response.status === 429
            ? "Muitas buscas ao mesmo tempo. Tente novamente em alguns segundos."
            : "O catálogo de contas está temporariamente indisponível.",
          code: response.status === 429 ? "CATALOG_BUSY" : "CATALOG_UNAVAILABLE",
        },
        { status: response.status === 429 ? 429 : 503 }
      );
    }

    const payload: unknown = await response.json().catch(() => null);
    return NextResponse.json(normalizeAccountPage(payload, game), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "O catálogo de contas está temporariamente indisponível.", code: "CATALOG_UNAVAILABLE" },
      { status: 503 }
    );
  }
}
