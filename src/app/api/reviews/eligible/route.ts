import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ products: [], authenticated: false });
  }

  const { data, error } = await supabase.rpc("get_reviewable_products");

  if (error) {
    return NextResponse.json({ error: "Não foi possível carregar suas compras avaliáveis." }, { status: 500 });
  }

  return NextResponse.json({
    authenticated: true,
    products: (data || []).map((item: any) => ({
      id: item.product_id,
      name: item.product_name,
      image: item.product_image || null,
      currentRating: item.current_rating || null,
      currentComment: item.current_comment || "",
      reviewedAt: item.reviewed_at || null,
    })),
  });
}
