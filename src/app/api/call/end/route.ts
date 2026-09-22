import { NextRequest, NextResponse } from "next/server";
import { callErrorResponse, getCallContext, unauthenticated } from "@/lib/call/server";
import { endLiveKitRoom } from "@/lib/call/livekit-server";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  const body = await request.json().catch(() => ({}));
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  if (!roomId) return NextResponse.json({ error: "INVALID_ROOM" }, { status: 400 });

  const { error } = await supabase.rpc("end_call_room", { p_room_id: roomId });
  if (error) return callErrorResponse(error.message, "ROOM_END_FAILED");

  await endLiveKitRoom(roomId);
  return NextResponse.json({ ok: true });
}
