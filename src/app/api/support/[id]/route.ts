import { NextResponse } from "next/server";
import {
  proxySupportJson,
  supportAuthHeader,
  supportEdgeUrl,
} from "../_shared";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authorization = await supportAuthHeader();
  if (!authorization) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { id } = await params;
  const response = await fetch(
    supportEdgeUrl("thread", { ticket_id: id }),
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
      },
    }
  );

  const proxied = await proxySupportJson(response);
  return NextResponse.json(proxied.body, {
    status: proxied.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
