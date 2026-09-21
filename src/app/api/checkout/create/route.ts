import { NextRequest, NextResponse } from "next/server";
import { checkoutAuthHeader, checkoutEdgeUrl, internalizeCartSnapshot, proxyJson } from "../_shared";

const actions = {
  pix: "create",
  card: "create-card",
  crypto: "create-crypto",
} as const;

export async function POST(request: NextRequest) {
  const authorization = await checkoutAuthHeader(request);
  if (!authorization) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const method = body?.method as keyof typeof actions;
  if (!body || !actions[method] || !Array.isArray(body.cart_snapshot)) {
    return NextResponse.json({ error: "Checkout inválido." }, { status: 400 });
  }

  const response = await fetch(checkoutEdgeUrl(actions[method]), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({
      cart_snapshot: internalizeCartSnapshot(body.cart_snapshot),
      coupon_code: body.coupon_code || "",
      description: "Compra CRAZZY PROJECT",
      idempotency_key: body.idempotency_key,
    }),
  });
  const proxied = await proxyJson(response);
  return NextResponse.json(proxied.body, { status: proxied.status });
}
