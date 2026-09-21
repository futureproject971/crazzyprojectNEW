import { NextRequest, NextResponse } from "next/server";
import { normalizeLztPage } from "@/modules/accounts-market/normalizer";

const DEFAULT_SUPABASE_URL = "https://nnmglkdpmffmaiuwbcct.supabase.co";

const scalarParams = new Set([
  "page",
  "pmin",
  "pmax",
  "title",
  "order_by",
  "rmin",
  "rmax",
  "last_rmin",
  "last_rmax",
  "previous_rmin",
  "previous_rmax",
  "valorant_level_min",
  "valorant_level_max",
  "valorant_smin",
  "valorant_smax",
  "valorant_knife_min",
  "valorant_knife_max",
  "vp_min",
  "vp_max",
  "rp_min",
  "rp_max",
  "fa_min",
  "fa_max",
  "inv_min",
  "inv_max",
  "knife",
  "nsb",
  "amin",
  "amax",
]);

const arrayParams = new Set([
  "weaponSkin[]",
  "buddy[]",
  "agent[]",
  "valorant_region[]",
  "valorant_rank_type[]",
  "email_type[]",
  "country[]",
]);

export async function GET(request: NextRequest) {
  const incoming = request.nextUrl.searchParams;
  const params = new URLSearchParams();
  params.set("action", "list");

  for (const [key, value] of incoming.entries()) {
    if (scalarParams.has(key)) params.set(key, value);
    if (arrayParams.has(key)) params.append(key, value);
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

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Não foi possível consultar o catálogo de contas agora.",
          providerStatus: response.status,
        },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    return NextResponse.json(normalizeLztPage(payload), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Falha temporária ao consultar o catálogo de contas." },
      { status: 502 }
    );
  }
}
