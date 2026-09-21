import { NextRequest, NextResponse } from "next/server";
import { checkoutAuthHeader, checkoutEdgeUrl, proxyJson } from "../_shared";

const actions = {
  pix: "status",
  card: "card-status",
  crypto: "crypto-status",
} as const;

export async function GET(request: NextRequest) {
  const authorization = await checkoutAuthHeader(request);
  if (!authorization) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const paymentId = request.nextUrl.searchParams.get("payment_id") || "";
  const method = request.nextUrl.searchParams.get("method") as keyof typeof actions;
  if (!paymentId || !actions[method]) {
    return NextResponse.json({ error: "Consulta inválida." }, { status: 400 });
  }

  const url = checkoutEdgeUrl(actions[method]);
  url.searchParams.set("payment_id", paymentId);

  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json", Authorization: authorization },
  });
  const proxied = await proxyJson(response);
  return NextResponse.json(proxied.body, { status: proxied.status });
}
