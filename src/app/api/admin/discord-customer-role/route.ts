import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  const { data, error } = await ctx.supabase!.from("discord_customer_settings").select("role_id,role_name").eq("id", true).single();
  if (error) return NextResponse.json({ error: "Não foi possível carregar o cargo Cliente." }, { status: 503 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
export async function PUT(request: NextRequest) {
  const ctx = await context();
  if (ctx.error) return ctx.error;
  const body = await request.json().catch(() => null);
  const roleId = String(body?.role_id || "").trim();
  if (roleId && !/^[0-9]{17,20}$/.test(roleId)) return NextResponse.json({ error: "Informe um ID de cargo Discord válido." }, { status: 400 });
  const { data, error } = await ctx.supabase!.from("discord_customer_settings").update({ role_id: roleId || null, role_name: "Cliente", updated_at: new Date().toISOString() }).eq("id", true).select("role_id,role_name").single();
  if (error || !data) return NextResponse.json({ error: "Não foi possível salvar o cargo Cliente." }, { status: 500 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
