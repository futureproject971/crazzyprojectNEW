import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validComboDiscounts } from "@/core/commerce/policy";
async function context() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Faça login para continuar." }, { status: 401 }) };
  const { data, error } = await supabase.rpc("is_current_admin");
  if (error || data !== true) return { error: NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 403 }) };
  return { supabase };
}
export async function GET() {
  const ctx = await context();
  if (ctx.error) return ctx.error;
  const { data, error } = await ctx.supabase!.from("commerce_combo_settings").select("discounts,updated_at").eq("id", true).single();
  if (error || !validComboDiscounts(data?.discounts)) return NextResponse.json({ error: "Não foi possível carregar as faixas." }, { status: 503 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
export async function PUT(request: NextRequest) {
  const ctx = await context();
  if (ctx.error) return ctx.error;
  const body = await request.json().catch(() => null);
  if (!validComboDiscounts(body?.discounts)) return NextResponse.json({ error: "Informe seis porcentagens inteiras de 0 a 99, sem diminuir o desconto nas faixas maiores." }, { status: 400 });
  const { data, error } = await ctx.supabase!.from("commerce_combo_settings").update({ discounts: body.discounts, updated_at: new Date().toISOString() })
    .eq("id", true).select("discounts,updated_at").single();
  if (error || !data) return NextResponse.json({ error: "Não foi possível salvar. Tente novamente." }, { status: 500 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
