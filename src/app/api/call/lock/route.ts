import { NextRequest, NextResponse } from "next/server";
import { callErrorResponse, getCallContext, unauthenticated } from "@/lib/call/server";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  const body = await request.json().catch(() => ({}));
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  const locked = body?.locked === true;
  if (!roomId) return NextResponse.json({ error: "INVALID_ROOM" }, { status: 400 });

  const { error } = await supabase.rpc("set_call_room_locked", {
    p_room_id: roomId,
    p_locked: locked,
  });
  if (error) return callErrorResponse(error.message, "ROOM_LOCK_FAILED");
  return NextResponse.json({ ok: true });
}
