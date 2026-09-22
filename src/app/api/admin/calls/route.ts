import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_current_admin");
  if (adminError || isAdmin !== true) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { data: rooms, error } = await supabase
    .from("call_rooms")
    .select("id,code,title,status,locked,owner_id,created_at,started_at,ended_at,call_participants!call_participants_room_id_fkey(display_name,role,left_at,kicked_at)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: "CALL_ADMIN_UNAVAILABLE" }, { status: 500 });
  }

  const normalized = (rooms || []).map((room) => {
    const participants = Array.isArray(room.call_participants) ? room.call_participants : [];
    const active = participants.filter((item) => !item.left_at && !item.kicked_at);
    const host = participants.find((item) => item.role === "host");

    return {
      id: room.id,
      code: room.code,
      title: room.title,
      status: room.status,
      locked: room.locked,
      owner_id: room.owner_id,
      host_name: host?.display_name || null,
      participant_count: active.length,
      created_at: room.created_at,
      started_at: room.started_at,
      ended_at: room.ended_at,
    };
  });

  return NextResponse.json({ rooms: normalized }, { headers: { "Cache-Control": "private, no-store" } });
}
