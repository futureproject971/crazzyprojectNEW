import { NextRequest, NextResponse } from "next/server";
import {
  libraryAuthHeader,
  libraryEdgeUrl,
  proxyLibraryJson,
} from "../_shared";

export async function POST(request: NextRequest) {
  const authorization = await libraryAuthHeader();
  if (!authorization) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const deliveryId = String(body?.delivery_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(deliveryId)) {
    return NextResponse.json({ error: "INVALID_DELIVERY" }, { status: 400 });
  }

  const response = await fetch(libraryEdgeUrl("copy-event"), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({ delivery_id: deliveryId }),
  });

  const proxied = await proxyLibraryJson(response);
  return NextResponse.json(proxied.body, {
    status: proxied.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
