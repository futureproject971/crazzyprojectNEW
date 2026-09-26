import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const OPEN_STATUSES = ["open", "waiting_staff"] as const;

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_current_admin");
  if (adminError || isAdmin !== true) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { count, error } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .in("status", [...OPEN_STATUSES]);

  if (error) {
    return NextResponse.json({ error: "TICKET_COUNT_FAILED" }, { status: 500 });
  }

  return NextResponse.json(
    { openCount: Number(count || 0) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
