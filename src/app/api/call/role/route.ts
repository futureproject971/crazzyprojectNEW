import { NextRequest, NextResponse } from "next/server";
import { callErrorResponse, getCallContext, unauthenticated } from "@/lib/call/server";
import { updateLiveKitParticipantRole } from "@/lib/call/livekit-server";
import type { CallParticipantRole } from "@/modules/call/types";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  const body = await request.json().catch(() => ({}));
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  const participantId = typeof body?.participantId === "string" ? body.participantId : "";
  const role = String(body?.role || "") as CallParticipantRole;
  if (!roomId || !participantId || !["cohost","participant","viewer"].includes(role)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const { data: participant } = await supabase
    .from("call_participants")
    .select("user_id")
    .eq("id", participantId)
    .eq("room_id", roomId)
    .maybeSingle();

  const { error } = await supabase.rpc("set_call_participant_role", {
    p_room_id: roomId,
    p_participant_id: participantId,
    p_role: role,
  });
  if (error) return callErrorResponse(error.message, "ROLE_UPDATE_FAILED");

  const {data: room} = await supabase.from("call_rooms").select("room_mode").eq("id",roomId).single();
  if (!room) return NextResponse.json({error:"ROOM_NOT_FOUND"},{status:404});
  if (participant?.user_id) {
    await updateLiveKitParticipantRole(roomId, participant.user_id, role, room.room_mode === "live" ? "live" : "call");
  }

  return NextResponse.json({ ok: true });
}
