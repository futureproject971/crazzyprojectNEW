import { NextRequest, NextResponse } from "next/server";
import { checkoutAuthHeader, checkoutEdgeUrl, internalizeCartSnapshot, proxyJson } from "../_shared";

export async function POST(request: NextRequest) {
  const authorization = await checkoutAuthHeader(request);
  if (!authorization) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.cart_snapshot)) {
    return NextResponse.json({ error: "Carrinho inválido." }, { status: 400 });
  }

  const response = await fetch(checkoutEdgeUrl("quote"), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({
      ...body,
      cart_snapshot: internalizeCartSnapshot(body.cart_snapshot),
    }),
  });
  const proxied = await proxyJson(response);
  return NextResponse.json(proxied.body, { status: proxied.status });
}
