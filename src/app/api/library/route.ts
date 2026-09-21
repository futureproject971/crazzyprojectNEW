import { NextResponse } from "next/server";
import {
  libraryAuthHeader,
  libraryEdgeUrl,
  proxyLibraryJson,
} from "./_shared";

export async function GET() {
  const authorization = await libraryAuthHeader();
  if (!authorization) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const response = await fetch(libraryEdgeUrl("snapshot"), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: authorization,
    },
  });

  const proxied = await proxyLibraryJson(response);
  return NextResponse.json(proxied.body, {
    status: proxied.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
