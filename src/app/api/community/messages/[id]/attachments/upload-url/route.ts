import { NextRequest, NextResponse } from "next/server";
import {
  communityAuthHeader,
  communityEdgeUrl,
  proxyCommunityJson,
} from "../../../../_shared";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authorization = await communityAuthHeader();
  if (!authorization) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const response = await fetch(communityEdgeUrl("upload-url"), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({
      message_id: id,
      filename: body?.filename || "",
      mime_type: body?.mime_type || "",
      size_bytes: Number(body?.size_bytes || 0),
    }),
  });

  const proxied = await proxyCommunityJson(response);
  return NextResponse.json(proxied.body, {
    status: proxied.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
