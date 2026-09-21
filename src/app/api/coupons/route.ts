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

  return NextResponse.json({
    authenticated: true,
    coupons: Array.isArray(data) ? data : [],
  });
}
