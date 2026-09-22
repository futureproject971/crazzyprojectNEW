import { NextRequest, NextResponse } from "next/server";
import { callErrorResponse, getCallContext, unauthenticated } from "@/lib/call/server";
import { removeLiveKitParticipant } from "@/lib/call/livekit-server";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCallContext();
  if (!user) return unauthenticated();

  const body = await request.json().catch(() => ({}));
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  const participantId = typeof body?.participantId === "string" ? body.participantId : "";
  if (!roomId || !participantId) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const { data: participant } = await supabase
    .from("call_participants")
    .select("user_id")
    .eq("id", participantId)
    .eq("room_id", roomId)
    .maybeSingle();

  const { error } = await supabase.rpc("kick_call_participant", {
    p_room_id: roomId,
    p_participant_id: participantId,
  });
  if (error) return callErrorResponse(error.message, "PARTICIPANT_KICK_FAILED");

  if (participant?.user_id) {
    await removeLiveKitParticipant(roomId, participant.user_id);
  }

  return NextResponse.json({ ok: true });
}
