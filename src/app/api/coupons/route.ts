import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ coupons: [], authenticated: false });

  const { data, error } = await supabase.rpc("get_my_coupons");
  if (error) {
    return NextResponse.json({ error: "Não foi possível carregar seus cupons." }, { status: 500 });
  }

  const coupons = (Array.isArray(data) ? data : []).map((coupon: any) => ({
    id: coupon.id,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    max_uses: coupon.max_uses,
    current_uses: coupon.current_uses,
    min_order_value: coupon.min_order_value,
    active: coupon.active,
    expires_at: coupon.expires_at,
    origin: coupon.origin,
    created_at: coupon.created_at,
    status: coupon.status,
    products: Array.isArray(coupon.products)
      ? coupon.products.map((product: any) => ({
          id: product.id,
          name: product.name,
          image_url: product.image_url || null,
        }))
      : [],
  }));

  return NextResponse.json({
    authenticated: true,
    coupons,
  });
}
