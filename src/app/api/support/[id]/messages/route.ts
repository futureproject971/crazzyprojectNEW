import { NextRequest, NextResponse } from "next/server";
import {
  proxySupportJson,
  supportAuthHeader,
  supportEdgeUrl,
} from "../../_shared";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authorization = await supportAuthHeader();
  if (!authorization) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const response = await fetch(supportEdgeUrl("message"), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({
      ticket_id: id,
      message: body?.message || "",
    }),
  });

  const proxied = await proxySupportJson(response);
  return NextResponse.json(proxied.body, {
    status: proxied.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
