import { NextRequest, NextResponse } from "next/server";
import { checkoutAuthHeader, checkoutEdgeUrl } from "@/app/api/checkout/_shared";

function jsonBody(response: Response) {
  return response.json().catch(() => ({ error: "Não foi possível concluir a operação com o provedor." }));
}

async function forward(
  request: NextRequest,
  action: "supplier-catalog" | "supplier-import" | "supplier-bind" | "supplier-sync",
  body?: unknown,
) {
  const authorization = await checkoutAuthHeader(request);
  if (!authorization) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const response = await fetch(checkoutEdgeUrl(action), {
      method: body === undefined ? "GET" : "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Authorization: authorization,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await jsonBody(response);
    return NextResponse.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "O provedor não respondeu a tempo. Tente novamente." },
      { status: 504 },
    );
  }
}

export async function GET(request: NextRequest) {
  return forward(request, "supplier-catalog");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim();

  if (action === "import") {
    if (!body?.productId || !Array.isArray(body?.selections) || body.selections.length === 0) {
      return NextResponse.json({ error: "Selecione pelo menos uma variação." }, { status: 400 });
    }
    return forward(request, "supplier-import", {
      productId: body.productId,
      selections: body.selections,
    });
  }

  if (action === "bind") {
    if (!body?.planId || !body?.selection) {
      return NextResponse.json({ error: "Plano ou variação inválida." }, { status: 400 });
    }
    return forward(request, "supplier-bind", {
      planId: body.planId,
      selection: body.selection,
    });
  }

  if (action === "sync") {
    if (!body?.planId) {
      return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
    }
    return forward(request, "supplier-sync", { planId: body.planId });
  }

  return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
}
