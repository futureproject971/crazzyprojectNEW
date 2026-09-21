import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

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

  const jar = await cookies();
  const token =
    jar.get("crazzy_access_token")?.value ||
    jar.get("sb-access-token")?.value ||
    "";

  return token ? "Bearer " + token : "";
}

export async function proxyJson(response: Response) {
  const body = await response.json().catch(() => ({ error: "Resposta inválida do backend." }));
  return { body, status: response.status };
}
