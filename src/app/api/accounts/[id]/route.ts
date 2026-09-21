import { NextRequest, NextResponse } from "next/server";
import { normalizeLztItem } from "@/modules/accounts-market/normalizer";
import type { AccountsMarketGame } from "@/modules/accounts-market/types";

const DEFAULT_SUPABASE_URL = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const games = new Set<AccountsMarketGame>(["valorant", "lol", "fortnite", "minecraft"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^\d{1,30}$/.test(id)) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
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

    const payload: any = await response.json().catch(() => null);

    if (!response.ok) {
      if (payload?.error === "LZT token not configured") {
        return NextResponse.json(
          { error: "Catálogo temporariamente em configuração.", code: "LZT_CREDENTIAL_MISSING" },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          error: response.status === 404 ? "Conta não encontrada." : "Não foi possível carregar esta conta.",
          code: "LZT_PROVIDER_ERROR",
        },
        { status: response.status === 404 ? 404 : 502 }
      );
    }

    return NextResponse.json(
      {
        item: normalizeLztItem(payload?.item, game),
        source: "lzt",
        credentialReady: true,
        commercialPriceReady: false,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Falha temporária ao carregar a conta.", code: "LZT_NETWORK_ERROR" },
      { status: 502 }
    );
  }
}
