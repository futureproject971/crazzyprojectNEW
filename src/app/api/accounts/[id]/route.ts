import { NextRequest, NextResponse } from "next/server";
import { normalizeLztItem } from "@/modules/accounts-market/normalizer";

const DEFAULT_SUPABASE_URL = "https://nnmglkdpmffmaiuwbcct.supabase.co";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
  const edgeUrl = new URL("/functions/v1/lzt-market", baseUrl);
  edgeUrl.searchParams.set("action", "detail");
  edgeUrl.searchParams.set("item_id", id);

  try {
    const response = await fetch(edgeUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: response.status === 404
            ? "Conta não encontrada."
            : "Não foi possível carregar esta conta.",
          providerStatus: response.status,
        },
        { status: response.status === 404 ? 404 : 502 }
      );
    }

    return NextResponse.json(
      {
        item: normalizeLztItem(payload),
        source: "lzt",
        commercialPriceReady: false,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Falha temporária ao carregar a conta." },
      { status: 502 }
    );
  }
}
