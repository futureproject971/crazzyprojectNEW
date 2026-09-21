import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const started = Date.now();

  const { data, error } = await supabase.rpc("get_public_status");

  if (error || !data) {
    return NextResponse.json(
      {
        error: "STATUS_TEMPORARILY_UNAVAILABLE",
        message: "Não foi possível consultar o status neste momento.",
        checked_at: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" },
      }
    );
  }

  const snapshot = data as any;
  return NextResponse.json(
    {
      components: Array.isArray(snapshot.components) ? snapshot.components : [],
      incidents: Array.isArray(snapshot.incidents) ? snapshot.incidents : [],
      generated_at: snapshot.generated_at || new Date().toISOString(),
      response_ms: Date.now() - started,
    },
    {
      headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" },
    }
  );
}
