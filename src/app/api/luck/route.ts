import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function publicPlayError(message: string) {
  if (message.includes("AUTH_REQUIRED")) return { status: 401, error: "Entre na sua conta para jogar." };
  if (message.includes("DAILY_LIMIT")) return { status: 429, error: "Sua jogada grátis de hoje já foi usada. Volte amanhã." };
  if (message.includes("PAYMENT_REQUIRED")) return { status: 402, error: "Esta jogada precisa de um pagamento confirmado." };
  if (message.includes("PAYMENT_NOT_CONFIRMED")) return { status: 409, error: "O pagamento desta jogada ainda não foi confirmado." };
  if (message.includes("PAYMENT_AMOUNT_INVALID")) return { status: 409, error: "O valor confirmado não corresponde à jogada." };
  if (message.includes("PAYMENT_ALREADY_USED")) return { status: 409, error: "Este pagamento já foi utilizado." };
  if (message.includes("PAYMENT_PURPOSE_INVALID")) return { status: 409, error: "Este pagamento não pertence a esta jogada CRAZZY LUCK." };
  if (message.includes("CAMPAIGN_UNAVAILABLE")) return { status: 404, error: "Esta campanha não está disponível." };
  if (message.includes("PRIZE_UNAVAILABLE")) return { status: 409, error: "Os prêmios desta campanha estão temporariamente indisponíveis." };
  return { status: 400, error: "Não foi possível concluir a jogada agora." };
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action") || "catalog";
  const supabase = await createServerSupabaseClient();

  if (action === "catalog") {
    const { data, error } = await supabase.rpc("get_luck_catalog");
    if (error) {
      return NextResponse.json({ error: "Não foi possível carregar o CRAZZY LUCK." }, { status: 500 });
    }
    return NextResponse.json({ campaigns: Array.isArray(data) ? data : [] });
  }

  if (action === "history") {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ history: [], authenticated: false });

    const { data, error } = await supabase.rpc("get_my_luck_history", {
      p_limit: Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("limit") || 50) || 50)),
    });
    if (error) return NextResponse.json({ error: "Não foi possível carregar seu histórico." }, { status: 500 });
    return NextResponse.json({ history: Array.isArray(data) ? data : [], authenticated: true });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");
  if (action !== "play") return NextResponse.json({ error: "Ação inválida." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Entre na sua conta para jogar." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const campaignSlug = String(body?.campaignSlug || "").trim();
  const idempotencyKey = String(body?.idempotencyKey || "").trim();
  const paymentId = body?.paymentId ? String(body.paymentId) : null;

  if (!campaignSlug || !idempotencyKey) {
    return NextResponse.json({ error: "Jogada inválida." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("play_luck", {
    p_campaign_slug: campaignSlug,
    p_idempotency_key: idempotencyKey,
    p_payment_id: paymentId,
  });

  if (error) {
    const mapped = publicPlayError(error.message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  return NextResponse.json({ result: data });
}
