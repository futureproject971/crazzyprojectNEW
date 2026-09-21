import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { getVerifiedAccessToken } from "@/lib/supabase/server";

const allowedGet = new Set(["catalog", "history", "status"]);
const allowedPost = new Set(["start", "heartbeat", "attention", "request"]);

async function proxy(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action") || "catalog";
  const isGet = request.method === "GET";

  if (isGet ? !allowedGet.has(action) : !allowedPost.has(action)) {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  const target = new URL(SUPABASE_URL + "/functions/v1/rewards");
  target.searchParams.set("action", action);

  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (key !== "action") target.searchParams.append(key, value);
  }

  const token = await getVerifiedAccessToken();
  const requiresAuth = action !== "catalog";
  if (requiresAuth && !token) {
    return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  }

  const headers: Record<string, string> = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = "Bearer " + token;

  const response = await fetch(target.toString(), {
    method: request.method,
    headers,
    body: isGet ? undefined : JSON.stringify(await request.json().catch(() => ({}))),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({ error: "Resposta inválida do serviço de recompensas." }));

  if (!response.ok && payload && typeof payload === "object") {
    const raw = String((payload as any).error || "");
    if (/secret|backend|supabase|service_role|token/i.test(raw)) {
      (payload as any).error = "Não foi possível concluir esta etapa agora.";
    }
  }

  return NextResponse.json(payload, { status: response.status });
}

export async function GET(request: NextRequest) {
  return proxy(request);
}

export async function POST(request: NextRequest) {
  return proxy(request);
}
