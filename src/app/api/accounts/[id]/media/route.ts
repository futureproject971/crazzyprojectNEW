import { NextRequest, NextResponse } from "next/server";
import type { AccountsMarketGame } from "@/modules/accounts-market/types";

const DEFAULT_SUPABASE_URL = "https://nnmglkdpmffmaiuwbcct.supabase.co";
const games = new Set<AccountsMarketGame>(["valorant", "lol", "fortnite", "minecraft"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^\d{1,30}$/.test(id)) {
    return new NextResponse(null, { status: 404 });
  }

  const gameParam = request.nextUrl.searchParams.get("game") || "valorant";
  const game = games.has(gameParam as AccountsMarketGame)
    ? (gameParam as AccountsMarketGame)
    : "valorant";
  const index = Number(request.nextUrl.searchParams.get("index") || "0");

  if (!Number.isInteger(index) || index < 0 || index > 23) {
    return new NextResponse(null, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
  const edgeUrl = new URL("/functions/v1/lzt-market", baseUrl);
  edgeUrl.searchParams.set("action", "preview-media-v2");
  edgeUrl.searchParams.set("item_id", id);
  edgeUrl.searchParams.set("game", game);
  edgeUrl.searchParams.set("index", String(index));

  try {
    const response = await fetch(edgeUrl, { cache: "force-cache" });
    if (!response.ok) return new NextResponse(null, { status: 404 });

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
