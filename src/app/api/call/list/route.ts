import { NextResponse } from "next/server";
import { getCallContext, unauthenticated } from "@/lib/call/server";

export async function GET() {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  const { data, error } = await supabase
    .from("call_rooms")
    .select("id,code,owner_id,title,status,locked,max_participants,created_at,started_at,ended_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "ROOM_LIST_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ rooms: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
