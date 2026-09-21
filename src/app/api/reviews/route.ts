import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function publicError(message: string) {
  if (message.includes("PURCHASE_REQUIRED")) return "É preciso ter uma compra verificada deste produto para avaliar.";
  if (message.includes("INVALID_RATING")) return "Escolha uma nota entre 1 e 5.";
  if (message.includes("INVALID_COMMENT")) return "O comentário deve ter entre 3 e 800 caracteres.";
  if (message.includes("AUTH_REQUIRED")) return "Entre na sua conta para publicar uma avaliação.";
  return "Não foi possível salvar sua avaliação agora.";
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const productId = request.nextUrl.searchParams.get("productId");
  const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("limit") || 40) || 40));

  const { data, error } = await supabase.rpc("get_public_reviews", {
    p_product_id: productId || null,
    p_limit: limit,
  });

  if (error) {
    return NextResponse.json({ error: "Não foi possível carregar as avaliações." }, { status: 500 });
  }

  const reviews = (data || []).map((review: any) => ({
    id: review.id,
    productId: review.product_id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.created_at,
    username: review.username || "Cliente CRAZZY",
    avatarUrl: review.avatar_url || null,
    productName: review.product_name || "Produto CRAZZY",
    productImage: review.product_image || null,
    verified: review.verified === true,
  }));

  return NextResponse.json({ reviews });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Entre na sua conta para publicar uma avaliação." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const productId = String(body?.productId || "");
  const rating = Number(body?.rating);
  const comment = String(body?.comment || "").trim();

  if (!productId) return NextResponse.json({ error: "Produto inválido." }, { status: 400 });

  const { data, error } = await supabase.rpc("submit_product_review", {
    p_product_id: productId,
    p_rating: rating,
    p_comment: comment,
  });

  if (error) {
    const status = error.message.includes("PURCHASE_REQUIRED") ? 403 : 400;
    return NextResponse.json({ error: publicError(error.message) }, { status });
  }

  return NextResponse.json({ review: data }, { status: 201 });
}
