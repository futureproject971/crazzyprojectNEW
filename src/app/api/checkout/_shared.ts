import type { NextRequest } from "next/server";
import { getVerifiedAccessToken } from "@/lib/supabase/server";

const DEFAULT_SUPABASE_URL = "https://nnmglkdpmffmaiuwbcct.supabase.co";

export function checkoutEdgeUrl(action: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
  const url = new URL("/functions/v1/purincash-payment", base);
  url.searchParams.set("action", action);
  return url;
}

export async function checkoutAuthHeader(request: NextRequest) {
  const direct = request.headers.get("authorization");
  if (direct?.startsWith("Bearer ")) return direct;

  const token = await getVerifiedAccessToken();
  return token ? "Bearer " + token : "";
}

export function internalizeCartSnapshot(items: unknown[]) {
  return (Array.isArray(items) ? items : []).map((raw) => {
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    if (item.type !== "account") return item;

    const accountId = String(item.accountId || "");
    const accountGame = String(item.accountGame || "valorant");
    return {
      productId: "lzt-" + accountId,
      planId: "lzt-account",
      quantity: 1,
      type: "lzt-account",
      lztItemId: accountId,
      lztGame: accountGame,
      productName: item.productName,
      productImage: item.productImage,
      planName: item.planName || "Conta",
    };
  });
}

function publicError(value: unknown) {
  const message = typeof value === "string" ? value : "";
  if (!message) return value;
  if (/lzt|provider|fornecedor|supabase|backend|token|credential|api\b/i.test(message)) {
    return "Este item está temporariamente indisponível. Tente novamente em instantes.";
  }
  return message;
}

export async function proxyJson(response: Response) {
  const body = await response.json().catch(() => ({ error: "Não foi possível concluir esta etapa." }));
  if (body && typeof body === "object" && "error" in body) {
    body.error = publicError(body.error);
  }
  return { body, status: response.status };
}
