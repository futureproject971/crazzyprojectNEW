import { NextResponse } from "next/server";
import {
  proxySupportJson,
  supportAuthHeader,
  supportEdgeUrl,
} from "../../../_shared";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authorization = await supportAuthHeader();
  if (!authorization) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { id } = await params;
  const response = await fetch(supportEdgeUrl("finalize-attachment"), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({ attachment_id: id }),
  });

  const proxied = await proxySupportJson(response);
  return NextResponse.json(proxied.body, {
    status: proxied.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
