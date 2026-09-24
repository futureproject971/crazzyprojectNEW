import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizePublicCatalog } from "@/modules/catalog/live";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_store_catalog");

  if (error) {
    return NextResponse.json({ error: "CATALOG_UNAVAILABLE" }, { status: 500 });
  }

  return NextResponse.json(
    { products: normalizePublicCatalog(data) },
    { headers: { "Cache-Control": "public, max-age=20, stale-while-revalidate=90" } }
  );
}
