import { NextRequest, NextResponse } from "next/server";
import {
  communityAuthHeader,
  communityEdgeUrl,
  proxyCommunityJson,
} from "../_shared";

export async function POST(request: NextRequest) {
  const authorization = await communityAuthHeader();
  if (!authorization) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const response = await fetch(communityEdgeUrl("message"), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({
      channel: body?.channel || "geral",
      message: body?.message || "",
      reply_to_message_id: body?.reply_to_message_id || null,
    }),
  });

  const proxied = await proxyCommunityJson(response);
  return NextResponse.json(proxied.body, {
    status: proxied.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
