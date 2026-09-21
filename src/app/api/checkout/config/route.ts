import { NextResponse } from "next/server";
import { checkoutEdgeUrl, proxyJson } from "../_shared";

export async function GET() {
  try {
    const response = await fetch(checkoutEdgeUrl("config"), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const { body, status } = await proxyJson(response);
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível consultar os métodos de pagamento." },
      { status: 502 }
    );
  }
}
