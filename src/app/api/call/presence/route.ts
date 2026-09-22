import { NextRequest, NextResponse } from "next/server";
import { callErrorResponse, getCallContext, unauthenticated } from "@/lib/call/server";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  const body = await request.json().catch(() => ({}));
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  const connected = body?.connected === true;
  if (!roomId) return NextResponse.json({ error: "INVALID_ROOM" }, { status: 400 });

  const { error } = await supabase.rpc("set_call_presence", {
    p_room_id: roomId,
    p_connected: connected,
  });
  if (error) return callErrorResponse(error.message, "PRESENCE_UPDATE_FAILED");
  return NextResponse.json({ ok: true });
}
