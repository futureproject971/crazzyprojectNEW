import { NextRequest, NextResponse } from "next/server";
import {
  communityAuthHeader,
  communityEdgeUrl,
  proxyCommunityJson,
} from "./_shared";

export async function GET(request: NextRequest) {
  const authorization = await communityAuthHeader();
  if (!authorization) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const channel = request.nextUrl.searchParams.get("channel") || "geral";
  const response = await fetch(
    communityEdgeUrl("snapshot", { channel }),
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
      },
    }
  );

  const proxied = await proxyCommunityJson(response);
  return NextResponse.json(proxied.body, {
    status: proxied.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
