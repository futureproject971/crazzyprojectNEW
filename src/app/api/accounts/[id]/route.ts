import { NextRequest, NextResponse } from "next/server";
import { normalizeAccountItem } from "@/modules/accounts-market/normalizer";
import type { AccountsMarketGame } from "@/modules/accounts-market/types";

const DEFAULT_SUPABASE_URL = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const games = new Set<AccountsMarketGame>(["valorant", "lol", "fortnite", "minecraft"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^\d{1,30}$/.test(id)) {
    return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
  }

  const requestedGame = request.nextUrl.searchParams.get("game") || "valorant";
  const game = games.has(requestedGame as AccountsMarketGame)
    ? (requestedGame as AccountsMarketGame)
    : "valorant";

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
  const edgeUrl = new URL("/functions/v1/lzt-market", baseUrl);
  edgeUrl.searchParams.set("action", "preview-detail-v2");
  edgeUrl.searchParams.set("item_id", id);
  edgeUrl.searchParams.set("game", game);

  try {
    const response = await fetch(edgeUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: response.status === 404
            ? "Esta conta não está mais disponível."
            : "Não foi possível carregar esta conta agora.",
          code: response.status === 404 ? "ACCOUNT_NOT_FOUND" : "ACCOUNT_UNAVAILABLE",
        },
        { status: response.status === 404 ? 404 : 503 }
      );
    }

    const payload: any = await response.json().catch(() => null);
    const source = payload?.item ?? payload;
    if (source && Array.isArray(source.cosmetics)) {
      source.cosmetics = source.cosmetics.map((entry: any) => ({
        name: String(entry?.name || "Item"),
        category: entry?.category ?? null,
        rarity: entry?.rarity ?? null,
        imagePath: Number.isInteger(entry?.mediaIndex)
          ? "/api/accounts/" + encodeURIComponent(id) + "/media?game=" + encodeURIComponent(game) + "&index=" + entry.mediaIndex
          : null,
      }));
    }
    return NextResponse.json(
      { item: normalizeAccountItem(source, game) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar esta conta agora.", code: "ACCOUNT_UNAVAILABLE" },
      { status: 503 }
    );
  }
}
