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
  const response = await fetch(communityEdgeUrl("reaction"), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({
      message_id: body?.message_id || "",
      emoji: body?.emoji || "",
    }),
  });

  const proxied = await proxyCommunityJson(response);
  return NextResponse.json(proxied.body, {
    status: proxied.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
