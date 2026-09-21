import { NextRequest, NextResponse } from "next/server";
import {
  proxySupportJson,
  supportAuthHeader,
  supportEdgeUrl,
} from "./_shared";

export async function GET() {
  const authorization = await supportAuthHeader();
  if (!authorization) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const response = await fetch(supportEdgeUrl("snapshot"), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: authorization,
    },
  });

  const proxied = await proxySupportJson(response);
  return NextResponse.json(proxied.body, {
    status: proxied.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  const authorization = await supportAuthHeader();
  if (!authorization) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const response = await fetch(supportEdgeUrl("create"), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify(body),
  });

  const proxied = await proxySupportJson(response);
  return NextResponse.json(proxied.body, {
    status: proxied.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
