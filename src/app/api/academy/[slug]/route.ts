import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("get_academy_tutorial", {
    p_slug: slug,
  });

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível carregar este tutorial." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "TUTORIAL_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(
    { tutorial: data },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
